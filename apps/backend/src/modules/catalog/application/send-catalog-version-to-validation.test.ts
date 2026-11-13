import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { CatalogVersion, type CatalogVersionStatus } from '../domain/entities/catalog-version.js';
import { EducationalObjective } from '../domain/entities/educational-objective.js';
import { GraduateAttribute } from '../domain/entities/graduate-attribute.js';
import {
  CatalogVersionNotFoundError,
  InvalidCatalogTransitionError,
} from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { SendCatalogVersionToValidationUseCase } from './send-catalog-version-to-validation.js';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const command = { actorId: 'user-1', ip: '10.0.0.1', versionId: 'v2' };

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

describe('SendCatalogVersionToValidationUseCase (T-015-07, RF-015, RS-020)', () => {
  let versionRepository: MockProxy<CatalogVersionRepository>;
  let objectiveReader: MockProxy<EducationalObjectiveReader>;
  let attributeReader: MockProxy<GraduateAttributeReader>;
  let permissionChecker: MockProxy<CatalogPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: SendCatalogVersionToValidationUseCase;

  beforeEach(() => {
    versionRepository = mock<CatalogVersionRepository>();
    objectiveReader = mock<EducationalObjectiveReader>();
    attributeReader = mock<GraduateAttributeReader>();
    permissionChecker = mock<CatalogPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    versionRepository.lockForEdit.mockResolvedValue(version());
    versionRepository.transitionStatus.mockResolvedValue(true);
    objectiveReader.listByVersion.mockResolvedValue([
      objective('o1', 'OEP1', 1),
      objective('o2', 'OEP2', 2),
    ]);
    attributeReader.listByVersion.mockResolvedValue([attribute('a1', 'AG-C01', 1)]);
    useCase = new SendCatalogVersionToValidationUseCase({
      versionRepository,
      objectiveReader,
      attributeReader,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => NOW,
    });
  });

  it('moves the draft to validation and audits the state change', async () => {
    const result = await useCase.execute(command);

    expect(result).toEqual({
      id: 'v2',
      programId: 'p1',
      number: 2,
      status: 'IN_VALIDATION',
      basedOnVersionId: 'v1',
      objectiveCount: 2,
      attributeCount: 1,
      createdAt: NOW.toISOString(),
    });
    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'catalogo.editar',
      scope: 'GLOBAL',
    });
    expect(versionRepository.transitionStatus).toHaveBeenCalledWith(
      'v2',
      'DRAFT',
      'IN_VALIDATION',
      'user-1',
      NOW,
    );
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'STATE_CHANGE',
      entity: 'CatalogVersion',
      entityId: 'v2',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: { status: 'DRAFT' },
      after: { status: 'IN_VALIDATION', objectiveCount: 2, attributeCount: 1 },
    });
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
  });

  it('rejects a version without attributes and changes nothing', async () => {
    attributeReader.listByVersion.mockResolvedValue([]);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(InvalidCatalogTransitionError);

    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a version without objectives and changes nothing', async () => {
    objectiveReader.listByVersion.mockResolvedValue([]);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(InvalidCatalogTransitionError);

    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it.each(['IN_VALIDATION', 'APPROVED', 'HISTORICAL'] as const)(
    'rejects a version that is not a draft (%s) and changes nothing',
    async (status) => {
      versionRepository.lockForEdit.mockResolvedValue(version(status));

      await expect(useCase.execute(command)).rejects.toBeInstanceOf(InvalidCatalogTransitionError);

      expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    },
  );

  it('fails with a transition error and no audit when no row was updated', async () => {
    versionRepository.transitionStatus.mockResolvedValue(false);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(InvalidCatalogTransitionError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails when the version does not exist', async () => {
    versionRepository.lockForEdit.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(CatalogVersionNotFoundError);

    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('denies the actor without permission before touching anything', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(versionRepository.lockForEdit).not.toHaveBeenCalled();
    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
