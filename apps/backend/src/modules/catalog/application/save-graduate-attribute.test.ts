import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { CATALOG_MAX_ITEMS } from '../domain/entities/catalog-limits.js';
import { CatalogVersion, type CatalogVersionStatus } from '../domain/entities/catalog-version.js';
import { GraduateAttribute } from '../domain/entities/graduate-attribute.js';
import {
  CatalogItemLimitReachedError,
  CatalogItemNotFoundError,
  CatalogVersionNotEditableError,
  CatalogVersionNotFoundError,
  DuplicateCatalogCodeError,
  InvalidCatalogDataError,
} from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import type { GraduateAttributeRepository } from '../domain/ports/graduate-attribute-repository.js';
import { SaveGraduateAttributeUseCase } from './save-graduate-attribute.js';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const base = { actorId: 'user-1', ip: '10.0.0.1', versionId: 'v2' };

function version(status: CatalogVersionStatus = 'DRAFT') {
  return CatalogVersion.create({
    id: 'v2',
    programId: 'p1',
    number: 2,
    status,
    basedOnVersionId: 'v1',
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function attribute(id: string, code: string, order: number) {
  return GraduateAttribute.create({
    id,
    versionId: 'v2',
    code,
    name: `Nombre ${code}`,
    statement: `Texto ${code}`,
    order,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('SaveGraduateAttributeUseCase (T-014-12, RF-014, RS-020)', () => {
  let versionRepository: MockProxy<CatalogVersionRepository>;
  let attributeReader: MockProxy<GraduateAttributeReader>;
  let attributeRepository: MockProxy<GraduateAttributeRepository>;
  let permissionChecker: MockProxy<CatalogPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: SaveGraduateAttributeUseCase;
  let stored: GraduateAttribute[];

  beforeEach(() => {
    versionRepository = mock<CatalogVersionRepository>();
    attributeReader = mock<GraduateAttributeReader>();
    attributeRepository = mock<GraduateAttributeRepository>();
    permissionChecker = mock<CatalogPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    versionRepository.lockForEdit.mockResolvedValue(version());
    stored = [attribute('o1', 'AG-C01', 1), attribute('o2', 'AG-C02', 2)];
    attributeReader.listByVersion.mockImplementation(async () => [...stored]);
    attributeRepository.insert.mockImplementation(async (item) => {
      stored = [...stored, item];
    });
    attributeRepository.update.mockImplementation(async (item) => {
      stored = stored.map((current) => (current.id === item.id ? item : current));
    });
    useCase = new SaveGraduateAttributeUseCase({
      versionRepository,
      attributeReader,
      attributeRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'new-id',
      clock: () => NOW,
    });
  });

  it('adds an attribute at the end and audits the creation', async () => {
    const result = await useCase.execute({
      ...base,
      name: 'Nombre',
      code: 'AG-C03',
      statement: 'Nuevo objetivo.',
    });

    expect(result.items.map((item) => [item.code, item.order])).toEqual([
      ['AG-C01', 1],
      ['AG-C02', 2],
      ['AG-C03', 3],
    ]);
    expect(attributeRepository.insert).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'CREATE',
      entity: 'GraduateAttribute',
      entityId: 'new-id',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: null,
      after: {
        versionId: 'v2',
        code: 'AG-C03',
        name: 'Nombre',
        statement: 'Nuevo objetivo.',
        order: 3,
      },
    });
  });

  it('accepts an incomplete but valid creation (one-character statement)', async () => {
    const result = await useCase.execute({
      ...base,
      name: 'Nombre',
      code: 'AG-C03',
      statement: 'x',
    });

    expect(result.items).toHaveLength(3);
  });

  it('edits an attribute keeping its order and audits before and after', async () => {
    const result = await useCase.execute({
      ...base,
      name: 'Nombre',
      id: 'o2',
      code: 'AG-C02',
      statement: 'Enunciado corregido.',
    });

    expect(result.items[1]).toMatchObject({
      code: 'AG-C02',
      statement: 'Enunciado corregido.',
      order: 2,
    });
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        entity: 'GraduateAttribute',
        entityId: 'o2',
        before: {
          versionId: 'v2',
          code: 'AG-C02',
          name: 'Nombre AG-C02',
          statement: 'Texto AG-C02',
          order: 2,
        },
        after: {
          versionId: 'v2',
          code: 'AG-C02',
          name: 'Nombre',
          statement: 'Enunciado corregido.',
          order: 2,
        },
      }),
    );
  });

  it('does not write or audit an edit without changes', async () => {
    const result = await useCase.execute({
      ...base,
      name: 'Nombre AG-C01',
      id: 'o1',
      code: ' AG-C01 ',
      statement: 'Texto AG-C01',
    });

    expect(result.items).toHaveLength(2);
    expect(attributeRepository.update).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a duplicated code when creating', async () => {
    await expect(
      useCase.execute({ ...base, name: 'Nombre', code: 'AG-C02', statement: 'Otro.' }),
    ).rejects.toBeInstanceOf(DuplicateCatalogCodeError);
    expect(attributeRepository.insert).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a duplicated code when editing', async () => {
    await expect(
      useCase.execute({ ...base, name: 'Nombre', id: 'o1', code: 'AG-C02', statement: 'Otro.' }),
    ).rejects.toBeInstanceOf(DuplicateCatalogCodeError);
    expect(attributeRepository.update).not.toHaveBeenCalled();
  });

  it('rejects changes when the version is not a draft', async () => {
    versionRepository.lockForEdit.mockResolvedValue(version('IN_VALIDATION'));

    await expect(
      useCase.execute({ ...base, name: 'Nombre', code: 'AG-C03', statement: 'Nuevo.' }),
    ).rejects.toBeInstanceOf(CatalogVersionNotEditableError);
    expect(attributeReader.listByVersion).not.toHaveBeenCalled();
    expect(attributeRepository.insert).not.toHaveBeenCalled();
  });

  it('answers not found for a version that does not exist', async () => {
    versionRepository.lockForEdit.mockResolvedValue(null);

    await expect(
      useCase.execute({ ...base, name: 'Nombre', code: 'AG-C03', statement: 'Nuevo.' }),
    ).rejects.toBeInstanceOf(CatalogVersionNotFoundError);
  });

  it('answers not found for an attribute of another version', async () => {
    await expect(
      useCase.execute({
        ...base,
        name: 'Nombre',
        id: 'ajeno',
        code: 'AG-C09',
        statement: 'Texto.',
      }),
    ).rejects.toBeInstanceOf(CatalogItemNotFoundError);
    expect(attributeRepository.update).not.toHaveBeenCalled();
  });

  it('rejects a new attribute when the version already has the maximum', async () => {
    stored = Array.from({ length: CATALOG_MAX_ITEMS }, (_, index) =>
      attribute(`o${index}`, `AG-C0${index + 1}`, index + 1),
    );

    await expect(
      useCase.execute({ ...base, name: 'Nombre', code: 'AG-C0999', statement: 'Uno más.' }),
    ).rejects.toBeInstanceOf(CatalogItemLimitReachedError);
  });

  it('rejects an invalid code through the domain', async () => {
    await expect(
      useCase.execute({ ...base, name: 'Nombre', code: 'bad', statement: 'Texto.' }),
    ).rejects.toBeInstanceOf(InvalidCatalogDataError);
  });

  it('denies access without catalogo.editar before reading anything', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({ ...base, name: 'Nombre', code: 'AG-C03', statement: 'Nuevo.' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'catalogo.editar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(versionRepository.lockForEdit).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('runs the lock, the write and the audit inside one transaction', async () => {
    await useCase.execute({ ...base, name: 'Nombre', code: 'AG-C03', statement: 'Nuevo.' });

    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    const order = [
      versionRepository.lockForEdit.mock.invocationCallOrder[0]!,
      attributeRepository.insert.mock.invocationCallOrder[0]!,
      auditLogger.log.mock.invocationCallOrder[0]!,
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
