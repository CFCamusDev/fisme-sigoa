import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  CatalogVersionNotAllowedError,
  DuplicateProcessExecutionError,
  ProcessCatalogVersionNotFoundError,
  ProcessProgramNotConfiguredError,
  ProcessSemesterNotFoundError,
} from '../domain/errors/index.js';
import type {
  ProcessCatalogVersionReader,
  ProcessExecutionRepository,
  ProcessPermissionChecker,
  ProcessProgramResolver,
  ProcessSemesterReader,
} from '../domain/ports/index.js';
import { CreateProcessExecutionUseCase } from './create-process-execution.js';

const NOW = new Date('2027-01-15T10:00:00.000Z');

describe('CreateProcessExecutionUseCase (HU-027, T-027-06, T-027-16)', () => {
  let repository: MockProxy<ProcessExecutionRepository>;
  let programResolver: MockProxy<ProcessProgramResolver>;
  let catalogVersionReader: MockProxy<ProcessCatalogVersionReader>;
  let semesterReader: MockProxy<ProcessSemesterReader>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: CreateProcessExecutionUseCase;

  beforeEach(() => {
    repository = mock<ProcessExecutionRepository>();
    programResolver = mock<ProcessProgramResolver>();
    catalogVersionReader = mock<ProcessCatalogVersionReader>();
    semesterReader = mock<ProcessSemesterReader>();
    permissionChecker = mock<ProcessPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    programResolver.getCurrentProgramId.mockResolvedValue('prog-1');
    catalogVersionReader.findById.mockResolvedValue({
      id: 'cv-1',
      number: 2,
      programId: 'prog-1',
      status: 'APPROVED',
    });

    useCase = new CreateProcessExecutionUseCase({
      processExecutionRepository: repository,
      programResolver,
      catalogVersionReader,
      semesterReader,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'exec-1',
      clock: () => NOW,
    });
  });

  it('creates the annual OE measurement 2027 as PLANNED with the current version', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.1',
      type: 'P612',
      year: 2027,
      catalogVersionId: 'cv-1',
    });

    expect(result).toEqual({
      id: 'exec-1',
      type: 'P612',
      name: 'Medición anual de OE 2027',
      year: 2027,
      semesterId: null,
      semesterCode: null,
      catalogVersionId: 'cv-1',
      catalogVersionNumber: 2,
      status: 'PLANNED',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'ejecucion.crear',
      scope: 'GLOBAL',
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
  });

  it('rejects the current version for a validation process', async () => {
    await expect(
      useCase.execute({
        actorId: 'user-1',
        type: 'P611',
        year: 2027,
        catalogVersionId: 'cv-1',
      }),
    ).rejects.toBeInstanceOf(CatalogVersionNotAllowedError);

    expect(repository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('denies a user without ejecucion.crear', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'user-2',
        type: 'P612',
        year: 2027,
        catalogVersionId: 'cv-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('fails when there is no program', async () => {
    programResolver.getCurrentProgramId.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        type: 'P612',
        year: 2027,
        catalogVersionId: 'cv-1',
      }),
    ).rejects.toBeInstanceOf(ProcessProgramNotConfiguredError);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('fails when the catalog version does not exist', async () => {
    catalogVersionReader.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        type: 'P612',
        year: 2027,
        catalogVersionId: 'missing-cv',
      }),
    ).rejects.toBeInstanceOf(ProcessCatalogVersionNotFoundError);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('fails when the semester does not exist', async () => {
    semesterReader.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        type: 'P622',
        year: 2027,
        semesterId: 'missing-sem',
        catalogVersionId: 'cv-1',
      }),
    ).rejects.toBeInstanceOf(ProcessSemesterNotFoundError);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('audits CREATE with the snapshot', async () => {
    await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.1',
      type: 'P612',
      year: 2027,
      catalogVersionId: 'cv-1',
    });

    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'CREATE',
      entity: 'ProcessExecution',
      entityId: 'exec-1',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: null,
      after: {
        id: 'exec-1',
        programId: 'prog-1',
        type: 'P612',
        name: 'Medición anual de OE 2027',
        year: 2027,
        semesterId: null,
        catalogVersionId: 'cv-1',
        status: 'PLANNED',
      },
    });
  });

  it('leaves no audit record when the save hits a duplicate name', async () => {
    repository.save.mockRejectedValueOnce(
      new DuplicateProcessExecutionError('Medición anual de OE 2027'),
    );

    await expect(
      useCase.execute({
        actorId: 'user-1',
        type: 'P612',
        year: 2027,
        catalogVersionId: 'cv-1',
      }),
    ).rejects.toBeInstanceOf(DuplicateProcessExecutionError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
