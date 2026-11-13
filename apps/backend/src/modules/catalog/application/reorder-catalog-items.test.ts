import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { CatalogVersion, type CatalogVersionStatus } from '../domain/entities/catalog-version.js';
import { EducationalObjective } from '../domain/entities/educational-objective.js';
import { GraduateAttribute } from '../domain/entities/graduate-attribute.js';
import {
  CatalogOrderMismatchError,
  CatalogVersionNotEditableError,
  CatalogVersionNotFoundError,
} from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { EducationalObjectiveRepository } from '../domain/ports/educational-objective-repository.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import type { GraduateAttributeRepository } from '../domain/ports/graduate-attribute-repository.js';
import { ReorderCatalogItemsUseCase } from './reorder-catalog-items.js';

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

function objective(id: string, code: string, order: number) {
  return EducationalObjective.create({
    id,
    versionId: 'v2',
    code,
    statement: `Texto ${code}`,
    order,
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

describe('ReorderCatalogItemsUseCase (T-014-14, RF-014, RS-020)', () => {
  let versionRepository: MockProxy<CatalogVersionRepository>;
  let objectiveReader: MockProxy<EducationalObjectiveReader>;
  let objectiveRepository: MockProxy<EducationalObjectiveRepository>;
  let attributeReader: MockProxy<GraduateAttributeReader>;
  let attributeRepository: MockProxy<GraduateAttributeRepository>;
  let permissionChecker: MockProxy<CatalogPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: ReorderCatalogItemsUseCase;
  let objectives: EducationalObjective[];
  let attributes: GraduateAttribute[];

  beforeEach(() => {
    versionRepository = mock<CatalogVersionRepository>();
    objectiveReader = mock<EducationalObjectiveReader>();
    objectiveRepository = mock<EducationalObjectiveRepository>();
    attributeReader = mock<GraduateAttributeReader>();
    attributeRepository = mock<GraduateAttributeRepository>();
    permissionChecker = mock<CatalogPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    versionRepository.lockForEdit.mockResolvedValue(version());
    objectives = [
      objective('o1', 'OEP1', 1),
      objective('o2', 'OEP2', 2),
      objective('o3', 'OEP3', 3),
    ];
    attributes = [attribute('a1', 'AG-C01', 1), attribute('a2', 'AG-C02', 2)];
    objectiveReader.listByVersion.mockImplementation(async () => [...objectives]);
    attributeReader.listByVersion.mockImplementation(async () => [...attributes]);
    objectiveRepository.updateOrders.mockImplementation(async (_versionId, changes) => {
      objectives = objectives
        .map((item) => {
          const change = changes.find((entry) => entry.id === item.id);
          return change ? item.withOrder(change.order, 'user-1', NOW) : item;
        })
        .sort((a, b) => a.order - b.order);
    });
    attributeRepository.updateOrders.mockImplementation(async (_versionId, changes) => {
      attributes = attributes
        .map((item) => {
          const change = changes.find((entry) => entry.id === item.id);
          return change ? item.withOrder(change.order, 'user-1', NOW) : item;
        })
        .sort((a, b) => a.order - b.order);
    });
    useCase = new ReorderCatalogItemsUseCase({
      versionRepository,
      objectiveReader,
      objectiveRepository,
      attributeReader,
      attributeRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => NOW,
    });
  });

  it('reorders objectives writing only the changed positions and audits the code order', async () => {
    const result = await useCase.execute({
      ...base,
      kind: 'OBJECTIVES',
      orderedIds: ['o3', 'o2', 'o1'],
    });

    expect(result.items.map((item) => [item.code, item.order])).toEqual([
      ['OEP3', 1],
      ['OEP2', 2],
      ['OEP1', 3],
    ]);
    expect(objectiveRepository.updateOrders).toHaveBeenCalledWith(
      'v2',
      [
        { id: 'o3', order: 1 },
        { id: 'o1', order: 3 },
      ],
      'user-1',
      NOW,
    );
    expect(attributeRepository.updateOrders).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'UPDATE',
      entity: 'CatalogVersion',
      entityId: 'v2',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: { kind: 'OBJECTIVES', orderedCodes: ['OEP1', 'OEP2', 'OEP3'] },
      after: { kind: 'OBJECTIVES', orderedCodes: ['OEP3', 'OEP2', 'OEP1'] },
    });
  });

  it('reorders attributes through the attribute port', async () => {
    const result = await useCase.execute({ ...base, kind: 'ATTRIBUTES', orderedIds: ['a2', 'a1'] });

    expect(result.items.map((item) => item.code)).toEqual(['AG-C02', 'AG-C01']);
    expect(attributeRepository.updateOrders).toHaveBeenCalledTimes(1);
    expect(objectiveRepository.updateOrders).not.toHaveBeenCalled();
  });

  it('does not write or audit when the order is already the requested one', async () => {
    const result = await useCase.execute({
      ...base,
      kind: 'OBJECTIVES',
      orderedIds: ['o1', 'o2', 'o3'],
    });

    expect(result.items).toHaveLength(3);
    expect(objectiveRepository.updateOrders).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing id', ['o1', 'o2']],
    ['an unknown id', ['o1', 'o2', 'zzz']],
    ['a repeated id', ['o1', 'o1', 'o2']],
  ])('rejects an outdated list with %s', async (_label, orderedIds) => {
    await expect(
      useCase.execute({ ...base, kind: 'OBJECTIVES', orderedIds }),
    ).rejects.toBeInstanceOf(CatalogOrderMismatchError);
    expect(objectiveRepository.updateOrders).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects changes when the version is not a draft', async () => {
    versionRepository.lockForEdit.mockResolvedValue(version('APPROVED'));

    await expect(
      useCase.execute({ ...base, kind: 'OBJECTIVES', orderedIds: ['o3', 'o2', 'o1'] }),
    ).rejects.toBeInstanceOf(CatalogVersionNotEditableError);
    expect(objectiveRepository.updateOrders).not.toHaveBeenCalled();
  });

  it('answers not found for a version that does not exist', async () => {
    versionRepository.lockForEdit.mockResolvedValue(null);

    await expect(
      useCase.execute({ ...base, kind: 'ATTRIBUTES', orderedIds: ['a1', 'a2'] }),
    ).rejects.toBeInstanceOf(CatalogVersionNotFoundError);
  });

  it('denies access without catalogo.editar before reading anything', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({ ...base, kind: 'OBJECTIVES', orderedIds: ['o3', 'o2', 'o1'] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(versionRepository.lockForEdit).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
