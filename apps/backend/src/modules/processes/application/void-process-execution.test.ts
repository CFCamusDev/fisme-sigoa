import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ProcessExecution } from '../domain/entities/process-execution.js';
import {
  ExecutionStatusConflictError,
  InvalidExecutionTransitionError,
  InvalidProcessExecutionDataError,
  ScheduleExecutionNotFoundError,
} from '../domain/errors/index.js';
import type {
  ProcessExecutionRepository,
  ProcessPermissionChecker,
} from '../domain/ports/index.js';
import { VoidProcessExecutionUseCase } from './void-process-execution.js';

const CREATED_AT = new Date('2027-01-10T10:00:00.000Z');
const VOID_NOW = new Date('2027-02-01T12:00:00.000Z');

function makeExecution(
  status: 'PLANNED' | 'IN_PROGRESS' | 'CONSOLIDATING' | 'PENDING_APPROVAL' | 'CLOSED' | 'VOIDED',
) {
  return ProcessExecution.rehydrate({
    id: 'exec-1',
    programId: 'prog-1',
    type: 'P612',
    name: 'Medición anual de OE 2027',
    year: 2027,
    semesterId: null,
    catalogVersionId: 'cv-1',
    status,
    voidReason: status === 'VOIDED' ? 'Motivo previo' : null,
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
}

describe('VoidProcessExecutionUseCase (HU-030, T-030-03, T-030-13)', () => {
  let repository: MockProxy<ProcessExecutionRepository>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: VoidProcessExecutionUseCase;

  beforeEach(() => {
    repository = mock<ProcessExecutionRepository>();
    permissionChecker = mock<ProcessPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();

    unitOfWork.run.mockImplementation(async (work) => work());
    repository.updateStatus.mockResolvedValue();

    useCase = new VoidProcessExecutionUseCase({
      processExecutionRepository: repository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => VOID_NOW,
    });
  });

  it('voids an open execution with a reason', async () => {
    for (const status of ['PLANNED', 'IN_PROGRESS', 'CONSOLIDATING', 'PENDING_APPROVAL'] as const) {
      repository.findByIdForUpdate.mockResolvedValue(makeExecution(status));
      repository.updateStatus.mockClear();

      const result = await useCase.execute({
        executionId: 'exec-1',
        reason: '  Cancelada por cambio de calendario  ',
        actorId: 'user-2',
        ip: '127.0.0.1',
      });

      expect(result).toEqual({
        executionId: 'exec-1',
        previousStatus: status,
        status: 'VOIDED',
        voidReason: 'Cancelada por cambio de calendario',
        updatedAt: VOID_NOW.toISOString(),
      });
      expect(repository.updateStatus).toHaveBeenCalledTimes(1);
      const [updatedExecution, expectedStatus] = repository.updateStatus.mock.calls[0]!;
      expect(updatedExecution.status).toBe('VOIDED');
      expect(updatedExecution.voidReason).toBe('Cancelada por cambio de calendario');
      expect(expectedStatus).toBe(status);
    }
  });

  it('rejects a void without reason', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('IN_PROGRESS'));

    await expect(
      useCase.execute({ executionId: 'exec-1', reason: '   ', actorId: 'user-2' }),
    ).rejects.toThrow(InvalidProcessExecutionDataError);
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a closed or voided execution', async () => {
    for (const status of ['CLOSED', 'VOIDED'] as const) {
      repository.findByIdForUpdate.mockResolvedValue(makeExecution(status));

      await expect(
        useCase.execute({ executionId: 'exec-1', reason: 'Motivo válido', actorId: 'user-2' }),
      ).rejects.toThrow(InvalidExecutionTransitionError);
    }
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('audits STATE_CHANGE with the reason', async () => {
    const execution = makeExecution('CONSOLIDATING');
    repository.findByIdForUpdate.mockResolvedValue(execution);

    await useCase.execute({
      executionId: 'exec-1',
      reason: 'Duplicidad detectada',
      actorId: 'user-2',
      ip: '10.0.0.1',
    });

    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'STATE_CHANGE',
      entity: 'ProcessExecution',
      entityId: 'exec-1',
      actor: 'user-2',
      ip: '10.0.0.1',
      before: execution.snapshot(),
      after: {
        ...execution.snapshot(),
        status: 'VOIDED',
        voidReason: 'Duplicidad detectada',
      },
    });
  });

  it('denies a user without ejecucion.anular', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({
        executionId: 'exec-1',
        reason: 'Motivo válido de anulación',
        actorId: 'user-2',
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-2',
      permission: 'ejecucion.anular',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(repository.findByIdForUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown execution', async () => {
    repository.findByIdForUpdate.mockResolvedValue(null);

    await expect(
      useCase.execute({
        executionId: 'missing',
        reason: 'Motivo válido de anulación',
        actorId: 'user-2',
      }),
    ).rejects.toThrow(ScheduleExecutionNotFoundError);
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails when the status changed between the lock and the update', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('IN_PROGRESS'));
    repository.updateStatus.mockRejectedValue(new ExecutionStatusConflictError());

    await expect(
      useCase.execute({
        executionId: 'exec-1',
        reason: 'Motivo válido de anulación',
        actorId: 'user-2',
      }),
    ).rejects.toThrow(ExecutionStatusConflictError);
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a reason shorter than 10 characters in the use case', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('IN_PROGRESS'));

    await expect(
      useCase.execute({ executionId: 'exec-1', reason: 'Corto', actorId: 'user-2' }),
    ).rejects.toThrow('El motivo de anulación debe tener entre 10 y 500 caracteres');
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
