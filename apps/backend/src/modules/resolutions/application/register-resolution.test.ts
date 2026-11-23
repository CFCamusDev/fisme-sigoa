import {
  RESOLUTION_NUMBER_MAX_LENGTH as SHARED_NUMBER_MAX_LENGTH,
  RESOLUTION_NUMBER_PATTERN as SHARED_NUMBER_PATTERN,
  RESOLUTION_STATUSES as SHARED_STATUSES,
  RESOLUTION_TYPES as SHARED_TYPES,
} from '@sigoa/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  RESOLUTION_NUMBER_MAX_LENGTH,
  RESOLUTION_NUMBER_PATTERN,
  RESOLUTION_STATUSES,
  RESOLUTION_TYPES,
} from '../domain/entities/resolution-enums.js';
import {
  CatalogVersionResolutionExistsError,
  DuplicateResolutionNumberError,
  InvalidResolutionDataError,
  ResolutionTypeNotAvailableError,
  ResolutionVersionNotFoundError,
  ResolutionVersionNotInValidationError,
} from '../domain/errors/index.js';
import type { ResolutionCatalogVersionReader } from '../domain/ports/resolution-catalog-version-reader.js';
import type { ResolutionPermissionChecker } from '../domain/ports/resolution-permission-checker.js';
import type { ResolutionRepository } from '../domain/ports/resolution-repository.js';
import { RegisterResolutionUseCase } from './register-resolution.js';

const NOW = new Date('2026-11-13T12:00:00.000Z');
const command = {
  actorId: 'user-1',
  ip: '10.0.0.1',
  type: 'EDUCATIONAL_OBJECTIVE',
  number: 'RD-012/2027',
  issuedOn: '2026-11-10',
  catalogVersionId: 'v1',
} as const;

describe('RegisterResolutionUseCase (T-048-06, RF-048, RS-020)', () => {
  let versionReader: MockProxy<ResolutionCatalogVersionReader>;
  let resolutionRepository: MockProxy<ResolutionRepository>;
  let permissionChecker: MockProxy<ResolutionPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: RegisterResolutionUseCase;

  beforeEach(() => {
    versionReader = mock<ResolutionCatalogVersionReader>();
    resolutionRepository = mock<ResolutionRepository>();
    permissionChecker = mock<ResolutionPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    versionReader.findById.mockResolvedValue({ id: 'v1', status: 'IN_VALIDATION' });
    useCase = new RegisterResolutionUseCase({
      versionReader,
      resolutionRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'r1',
      clock: () => NOW,
    });
  });

  it('registers, links the version and audits the creation', async () => {
    const result = await useCase.execute(command);

    expect(result).toEqual({
      id: 'r1',
      type: 'EDUCATIONAL_OBJECTIVE',
      number: 'RD-012/2027',
      issuedOn: '2026-11-10',
      status: 'REGISTERED',
      catalogVersionId: 'v1',
      pdfFileId: null,
      approvedAt: null,
      approvedBy: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'resolucion.registrar',
      scope: 'GLOBAL',
    });
    expect(resolutionRepository.save).toHaveBeenCalledTimes(1);
    const saved = resolutionRepository.save.mock.calls[0]?.[0];
    expect(saved?.id).toBe('r1');
    expect(saved?.status).toBe('REGISTERED');
    expect(saved?.issuedOn.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'CREATE',
      entity: 'Resolution',
      entityId: 'r1',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: null,
      after: {
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'RD-012/2027',
        issuedOn: '2026-11-10',
        status: 'REGISTERED',
        catalogVersionId: 'v1',
      },
    });
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
  });

  it('registers a graduate attribute resolution', async () => {
    const result = await useCase.execute({ ...command, type: 'GRADUATE_ATTRIBUTE' });

    expect(result.type).toBe('GRADUATE_ATTRIBUTE');
  });

  it('denies the action without the permission and touches nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(versionReader.findById).not.toHaveBeenCalled();
    expect(resolutionRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a missing catalog version and changes nothing', async () => {
    versionReader.findById.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ResolutionVersionNotFoundError);

    expect(resolutionRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it.each(['DRAFT', 'APPROVED', 'HISTORICAL'] as const)(
    'rejects a catalog version that is %s',
    async (status) => {
      versionReader.findById.mockResolvedValue({ id: 'v1', status });

      await expect(useCase.execute(command)).rejects.toBeInstanceOf(
        ResolutionVersionNotInValidationError,
      );

      expect(resolutionRepository.save).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'duplicate number',
      DuplicateResolutionNumberError,
      () => new DuplicateResolutionNumberError(),
    ],
    [
      'existing catalog version resolution',
      CatalogVersionResolutionExistsError,
      () => new CatalogVersionResolutionExistsError(),
    ],
  ])(
    'propagates the specific duplicate error (%s) and does not audit',
    async (_label, ErrorClass, makeError) => {
      resolutionRepository.save.mockRejectedValue(makeError());

      await expect(useCase.execute(command)).rejects.toBeInstanceOf(ErrorClass);

      expect(auditLogger.log).not.toHaveBeenCalled();
    },
  );

  it('rejects the improvement plan type until it is available, without reading anything', async () => {
    await expect(useCase.execute({ ...command, type: 'IMPROVEMENT_PLAN' })).rejects.toBeInstanceOf(
      ResolutionTypeNotAvailableError,
    );

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(resolutionRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    { number: '' },
    { number: 'R'.repeat(41) },
    { number: 'RD#1' },
    { issuedOn: '2026-02-30' },
    { issuedOn: 'no-es-fecha' },
  ])('rejects the invalid data %j before opening the transaction', async (change) => {
    await expect(useCase.execute({ ...command, ...change })).rejects.toBeInstanceOf(
      InvalidResolutionDataError,
    );

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(resolutionRepository.save).not.toHaveBeenCalled();
  });

  describe('contract parity between @sigoa/shared and the domain', () => {
    it('uses the same types, statuses and number rules on both sides', () => {
      expect([...SHARED_TYPES]).toEqual([...RESOLUTION_TYPES]);
      expect([...SHARED_STATUSES]).toEqual([...RESOLUTION_STATUSES]);
      expect(SHARED_NUMBER_MAX_LENGTH).toBe(RESOLUTION_NUMBER_MAX_LENGTH);
      expect(SHARED_NUMBER_PATTERN.source).toBe(RESOLUTION_NUMBER_PATTERN.source);
    });
  });
});
