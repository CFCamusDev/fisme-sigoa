import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { CatalogVersion } from '../domain/entities/catalog-version.js';
import { EducationalObjective } from '../domain/entities/educational-objective.js';
import { GraduateAttribute } from '../domain/entities/graduate-attribute.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogProgramReader } from '../domain/ports/catalog-program-reader.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { EducationalObjectiveRepository } from '../domain/ports/educational-objective-repository.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import type { GraduateAttributeRepository } from '../domain/ports/graduate-attribute-repository.js';
import { CreateCatalogVersionUseCase } from './create-catalog-version.js';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const command = { actorId: 'user-1', ip: '10.0.0.1' };

function version(id: string, number: number, status: 'APPROVED' | 'DRAFT' | 'IN_VALIDATION') {
  return CatalogVersion.create({
    id,
    programId: 'p1',
    number,
    status,
    basedOnVersionId: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function objective(id: string, code: string, order: number) {
  return EducationalObjective.create({
    id,
    versionId: 'v1',
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
    versionId: 'v1',
    code,
    name: `Nombre ${code}`,
    statement: `Texto ${code}`,
    order,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('CreateCatalogVersionUseCase (T-013-10, T-013-18, RF-013, RS-020)', () => {
  let programReader: MockProxy<CatalogProgramReader>;
  let versionReader: MockProxy<CatalogVersionReader>;
  let versionRepository: MockProxy<CatalogVersionRepository>;
  let objectiveReader: MockProxy<EducationalObjectiveReader>;
  let objectiveRepository: MockProxy<EducationalObjectiveRepository>;
  let attributeReader: MockProxy<GraduateAttributeReader>;
  let attributeRepository: MockProxy<GraduateAttributeRepository>;
  let permissionChecker: MockProxy<CatalogPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: CreateCatalogVersionUseCase;
  let counter: number;

  beforeEach(() => {
    counter = 0;
    programReader = mock<CatalogProgramReader>();
    versionReader = mock<CatalogVersionReader>();
    versionRepository = mock<CatalogVersionRepository>();
    objectiveReader = mock<EducationalObjectiveReader>();
    objectiveRepository = mock<EducationalObjectiveRepository>();
    attributeReader = mock<GraduateAttributeReader>();
    attributeRepository = mock<GraduateAttributeRepository>();
    permissionChecker = mock<CatalogPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    programReader.getCurrentProgramId.mockResolvedValue('p1');
    versionReader.findOpen.mockResolvedValue(null);
    versionReader.findCurrent.mockResolvedValue(version('v1', 1, 'APPROVED'));
    versionReader.maxNumber.mockResolvedValue(1);
    objectiveReader.listByVersion.mockResolvedValue([
      objective('o1', 'OEP1', 1),
      objective('o2', 'OEP2', 2),
    ]);
    attributeReader.listByVersion.mockResolvedValue([attribute('a1', 'AG-C01', 1)]);
    useCase = new CreateCatalogVersionUseCase({
      programReader,
      versionReader,
      versionRepository,
      objectiveReader,
      objectiveRepository,
      attributeReader,
      attributeRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => `id-${++counter}`,
      clock: () => NOW,
    });
  });

  it('copies the current version objectives and attributes into a draft', async () => {
    const dto = await useCase.execute(command);

    const saved = versionRepository.save.mock.calls[0]![0];
    expect(saved.status).toBe('DRAFT');
    expect(saved.number).toBe(2);
    expect(saved.basedOnVersionId).toBe('v1');
    expect(dto).toMatchObject({
      number: 2,
      status: 'DRAFT',
      basedOnVersionId: 'v1',
      objectiveCount: 2,
      attributeCount: 1,
      createdAt: NOW.toISOString(),
    });
    const copiedObjectives = objectiveRepository.insertMany.mock.calls[0]![1];
    expect(copiedObjectives.map((item) => [item.code, item.order, item.versionId])).toEqual([
      ['OEP1', 1, saved.id],
      ['OEP2', 2, saved.id],
    ]);
    expect(copiedObjectives.map((item) => item.id)).not.toContain('o1');
    expect(attributeRepository.insertMany.mock.calls[0]![1].map((item) => item.code)).toEqual([
      'AG-C01',
    ]);
  });

  it('checks catalogo.editar with GLOBAL scope before reading anything', async () => {
    await useCase.execute(command);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'catalogo.editar',
      scope: 'GLOBAL',
    });
    expect(permissionChecker.assertAllowed.mock.invocationCallOrder[0]).toBeLessThan(
      programReader.getCurrentProgramId.mock.invocationCallOrder[0]!,
    );
  });

  it('does nothing when the permission is denied', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ForbiddenError);

    expect(programReader.getCurrentProgramId).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(versionRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails with a typed not found error when there is no program', async () => {
    programReader.getCurrentProgramId.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(CatalogProgramNotFoundError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
  });
});
