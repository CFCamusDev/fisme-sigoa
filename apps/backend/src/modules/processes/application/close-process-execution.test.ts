import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ProcessExecution } from '../domain/entities/process-execution.js';
import { PRECONDITION_LABELS } from '../domain/entities/process-execution-precondition.js';
import {
  ExecutionPreconditionsNotMetError,
  ExecutionStatusConflictError,
  InvalidExecutionTransitionError,
  ScheduleExecutionNotFoundError,
} from '../domain/errors/index.js';
import type {
  ExecutionPreconditionProvider,
  ProcessExecutionRepository,
  ProcessPermissionChecker,
} from '../domain/ports/index.js';
import { CloseProcessExecutionUseCase } from './close-process-execution.js';
import { ExecutionPreconditionEvaluator } from './execution-precondition-evaluator.js';

const CREATED_AT = new Date('2027-01-10T10:00:00.000Z');
const CLOSE_NOW = new Date('2027-02-01T12:00:00.000Z');

function makeExecution(
  status: 'PLANNED' | 'IN_PROGRESS' | 'CONSOLIDATING' | 'PENDING_APPROVAL' | 'CLOSED' | 'VOIDED',
) {
  return ProcessExecution.rehydrate({
    id: 'exec-1',
    programId: 'prog-1',
    type: 'P611',
    name: 'Establecer OE 2027',
    year: 2027,
    semesterId: null,
    catalogVersionId: 'cv-1',
    status,
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
}

describe('CloseProcessExecutionUseCase (HU-030, T-030-02, T-030-12)', () => {
  let repository: MockProxy<ProcessExecutionRepository>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let resolutionProvider: MockProxy<ExecutionPreconditionProvider>;
  let useCase: CloseProcessExecutionUseCase;

  beforeEach(() => {
    repository = mock<ProcessExecutionRepository>();
    permissionChecker = mock<ProcessPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    resolutionProvider = mock<ExecutionPreconditionProvider>({
      codes: ['RESOLUTION_APPROVED'],
    });

    unitOfWork.run.mockImplementation(async (work) => work());
    repository.updateStatus.mockResolvedValue();

    useCase = new CloseProcessExecutionUseCase({
      processExecutionRepository: repository,
      permissionChecker,
      preconditionEvaluator: new ExecutionPreconditionEvaluator([resolutionProvider]),
      unitOfWork,
      auditLogger,
      clock: () => CLOSE_NOW,
    });
  });

  it('closes a pending approval execution with an approved resolution', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('PENDING_APPROVAL'));
    resolutionProvider.evaluate.mockResolvedValue([
      {
        code: 'RESOLUTION_APPROVED',
        label: PRECONDITION_LABELS.RESOLUTION_APPROVED,
        state: 'MET',
      },
    ]);

    const result = await useCase.execute({
      executionId: 'exec-1',
      actorId: 'user-2',
      ip: '127.0.0.1',
    });

    expect(result).toEqual({
      executionId: 'exec-1',
      previousStatus: 'PENDING_APPROVAL',
      status: 'CLOSED',
      updatedAt: CLOSE_NOW.toISOString(),
    });
    expect(repository.updateStatus).toHaveBeenCalledTimes(1);
    const [updatedExecution, expectedStatus] = repository.updateStatus.mock.calls[0]!;
    expect(updatedExecution.status).toBe('CLOSED');
    expect(expectedStatus).toBe('PENDING_APPROVAL');
  });

  it('rejects with the unmet precondition and changes nothing', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('PENDING_APPROVAL'));
    resolutionProvider.evaluate.mockResolvedValue([
      {
        code: 'RESOLUTION_APPROVED',
        label: PRECONDITION_LABELS.RESOLUTION_APPROVED,
        state: 'UNMET',
      },
    ]);

    const error = await useCase
      .execute({ executionId: 'exec-1', actorId: 'user-2' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ExecutionPreconditionsNotMetError);
    expect((error as ExecutionPreconditionsNotMetError).details).toEqual([
      {
        path: 'RESOLUTION_APPROVED',
        message: PRECONDITION_LABELS.RESOLUTION_APPROVED,
      },
    ]);
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects an execution that is not pending approval', async () => {
    for (const status of ['PLANNED', 'IN_PROGRESS', 'CONSOLIDATING', 'CLOSED', 'VOIDED'] as const) {
      repository.findByIdForUpdate.mockResolvedValue(makeExecution(status));

      await expect(useCase.execute({ executionId: 'exec-1', actorId: 'user-2' })).rejects.toThrow(
        InvalidExecutionTransitionError,
      );
    }
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('audits STATE_CHANGE with the previous and the new status in the same transaction', async () => {
    const pending = makeExecution('PENDING_APPROVAL');
    repository.findByIdForUpdate.mockResolvedValue(pending);
    resolutionProvider.evaluate.mockResolvedValue([
      {
        code: 'RESOLUTION_APPROVED',
        label: PRECONDITION_LABELS.RESOLUTION_APPROVED,
        state: 'MET',
      },
    ]);

    await useCase.execute({
      executionId: 'exec-1',
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
      before: pending.snapshot(),
      after: {
        ...pending.snapshot(),
        status: 'CLOSED',
      },
    });
  });

  it('denies a user without ejecucion.cerrar', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute({ executionId: 'exec-1', actorId: 'user-2' })).rejects.toThrow(
      ForbiddenError,
    );
    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-2',
      permission: 'ejecucion.cerrar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(repository.findByIdForUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown execution', async () => {
    repository.findByIdForUpdate.mockResolvedValue(null);

    await expect(useCase.execute({ executionId: 'missing', actorId: 'user-2' })).rejects.toThrow(
      ScheduleExecutionNotFoundError,
    );
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails when the status changed between the lock and the update', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('PENDING_APPROVAL'));
    resolutionProvider.evaluate.mockResolvedValue([
      {
        code: 'RESOLUTION_APPROVED',
        label: PRECONDITION_LABELS.RESOLUTION_APPROVED,
        state: 'MET',
      },
    ]);
    repository.updateStatus.mockRejectedValue(new ExecutionStatusConflictError());

    await expect(useCase.execute({ executionId: 'exec-1', actorId: 'user-2' })).rejects.toThrow(
      ExecutionStatusConflictError,
    );
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
