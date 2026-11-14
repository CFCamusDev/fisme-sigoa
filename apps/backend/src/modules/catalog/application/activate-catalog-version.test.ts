import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { CatalogVersion, type CatalogVersionStatus } from '../domain/entities/catalog-version.js';
import {
  CatalogVersionNotFoundError,
  InvalidCatalogTransitionError,
} from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { ActivateCatalogVersionUseCase } from './activate-catalog-version.js';

const NOW = new Date('2026-11-13T12:00:00.000Z');
const command = { actorId: 'user-1', ip: '10.0.0.1', versionId: 'v2', resolutionId: 'r1' };

function version(id: string, status: CatalogVersionStatus, number: number) {
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

describe('ActivateCatalogVersionUseCase (T-016-05, RF-016, RS-020)', () => {
  let versionReader: MockProxy<CatalogVersionReader>;
  let versionRepository: MockProxy<CatalogVersionRepository>;
  let objectiveReader: MockProxy<EducationalObjectiveReader>;
  let attributeReader: MockProxy<GraduateAttributeReader>;
  let permissionChecker: MockProxy<CatalogPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: ActivateCatalogVersionUseCase;

  beforeEach(() => {
    versionReader = mock<CatalogVersionReader>();
    versionRepository = mock<CatalogVersionRepository>();
    objectiveReader = mock<EducationalObjectiveReader>();
    attributeReader = mock<GraduateAttributeReader>();
    permissionChecker = mock<CatalogPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    versionReader.findById.mockResolvedValue(version('v2', 'IN_VALIDATION', 2));
    versionReader.findCurrent.mockResolvedValue(version('v1', 'APPROVED', 1));
    versionRepository.lockForEdit.mockResolvedValue(version('v2', 'IN_VALIDATION', 2));
    versionRepository.transitionStatus.mockResolvedValue(true);
    objectiveReader.listByVersion.mockResolvedValue([]);
    attributeReader.listByVersion.mockResolvedValue([]);
    useCase = new ActivateCatalogVersionUseCase({
      versionReader,
      versionRepository,
      objectiveReader,
      attributeReader,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => NOW,
    });
  });

  it('activates the version, demotes the previous one and audits both', async () => {
    const dto = await useCase.execute(command);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'resolucion.aprobar',
      scope: 'GLOBAL',
    });
    expect(versionRepository.transitionStatus.mock.calls).toEqual([
      ['v1', 'APPROVED', 'HISTORICAL', 'user-1', NOW],
      ['v2', 'IN_VALIDATION', 'APPROVED', 'user-1', NOW],
    ]);
    expect(auditLogger.log).toHaveBeenCalledTimes(2);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATE_CHANGE',
        entity: 'CatalogVersion',
        entityId: 'v1',
        before: { status: 'APPROVED' },
        after: expect.objectContaining({ status: 'HISTORICAL', supersededBy: 'v2' }),
      }),
    );
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'v2',
        before: { status: 'IN_VALIDATION' },
        after: { status: 'APPROVED', resolutionId: 'r1' },
      }),
    );
    expect(dto).toMatchObject({ id: 'v2', status: 'APPROVED' });
  });

  it('activates without demoting when there is no previous current version', async () => {
    versionReader.findCurrent.mockResolvedValue(null);

    await useCase.execute(command);

    expect(versionRepository.transitionStatus).toHaveBeenCalledTimes(1);
    expect(versionRepository.transitionStatus).toHaveBeenCalledWith(
      'v2',
      'IN_VALIDATION',
      'APPROVED',
      'user-1',
      NOW,
    );
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
  });

  it('rejects without resolucion.aprobar and changes nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso.'));

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('does nothing when the version is already current', async () => {
    const current = version('v2', 'APPROVED', 2);
    versionRepository.lockForEdit.mockResolvedValue(current);
    versionReader.findCurrent.mockResolvedValue(current);

    const dto = await useCase.execute(command);

    expect(dto).toMatchObject({ id: 'v2', status: 'APPROVED' });
    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails with 409 when another transaction changed the state', async () => {
    versionRepository.transitionStatus.mockResolvedValue(false);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(InvalidCatalogTransitionError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails with 409 when the candidate is a draft', async () => {
    versionRepository.lockForEdit.mockResolvedValue(version('v2', 'DRAFT', 2));

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(InvalidCatalogTransitionError);

    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
  });

  it('fails with 404 for an unknown version', async () => {
    versionReader.findById.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(CatalogVersionNotFoundError);

    expect(versionRepository.lockProgram).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('locks the program before the version', async () => {
    const order: string[] = [];
    versionRepository.lockProgram.mockImplementation(async () => {
      order.push('program');
    });
    versionRepository.lockForEdit.mockImplementation(async () => {
      order.push('version');
      return version('v2', 'IN_VALIDATION', 2);
    });

    await useCase.execute(command);

    expect(order).toEqual(['program', 'version']);
    expect(versionRepository.lockProgram).toHaveBeenCalledWith('p1');
  });
});
