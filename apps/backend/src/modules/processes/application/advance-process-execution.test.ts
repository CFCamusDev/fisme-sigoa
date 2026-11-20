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
import { AdvanceProcessExecutionUseCase } from './advance-process-execution.js';
import { ExecutionPreconditionEvaluator } from './execution-precondition-evaluator.js';

const CREATED_AT = new Date('2027-01-10T10:00:00.000Z');
const ADVANCE_NOW = new Date('2027-01-15T12:00:00.000Z');

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
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
}

describe('AdvanceProcessExecutionUseCase (HU-029, T-029-02, T-029-09)', () => {
  let repository: MockProxy<ProcessExecutionRepository>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let scheduleProvider: MockProxy<ExecutionPreconditionProvider>;
  let minutesProvider: MockProxy<ExecutionPreconditionProvider>;
  let useCase: AdvanceProcessExecutionUseCase;

  beforeEach(() => {
    repository = mock<ProcessExecutionRepository>();
    permissionChecker = mock<ProcessPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    scheduleProvider = mock<ExecutionPreconditionProvider>({
      codes: ['SCHEDULE_HAS_ACTIVITY'],
    });
    minutesProvider = mock<ExecutionPreconditionProvider>({
      codes: ['SESSIONS_SURVEYS_CLOSED', 'SESSIONS_MINUTES_SIGNED'],
    });

    unitOfWork.run.mockImplementation(async (work) => work());
    repository.updateStatus.mockResolvedValue();

    useCase = new AdvanceProcessExecutionUseCase({
      processExecutionRepository: repository,
      permissionChecker,
      preconditionEvaluator: new ExecutionPreconditionEvaluator([
        scheduleProvider,
        minutesProvider,
      ]),
      unitOfWork,
      auditLogger,
      clock: () => ADVANCE_NOW,
    });
  });

  it('advances a planned execution with a schedule to IN_PROGRESS', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('PLANNED'));
    scheduleProvider.evaluate.mockResolvedValue([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
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
      previousStatus: 'PLANNED',
      status: 'IN_PROGRESS',
      updatedAt: ADVANCE_NOW.toISOString(),
    });
    expect(repository.updateStatus).toHaveBeenCalledTimes(1);
    const [updatedExecution, expectedStatus] = repository.updateStatus.mock.calls[0]!;
    expect(updatedExecution.status).toBe('IN_PROGRESS');
    expect(expectedStatus).toBe('PLANNED');
  });

  it('rejects with the list of unmet preconditions and changes nothing', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('IN_PROGRESS'));
    minutesProvider.evaluate.mockResolvedValue([
      {
        code: 'SESSIONS_SURVEYS_CLOSED',
        label: PRECONDITION_LABELS.SESSIONS_SURVEYS_CLOSED,
        state: 'MET',
      },
      {
        code: 'SESSIONS_MINUTES_SIGNED',
        label: PRECONDITION_LABELS.SESSIONS_MINUTES_SIGNED,
        state: 'UNMET',
      },
    ]);

    const error = await useCase
      .execute({ executionId: 'exec-1', actorId: 'user-2' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ExecutionPreconditionsNotMetError);
    expect((error as ExecutionPreconditionsNotMetError).details).toEqual([
      {
        path: 'SESSIONS_MINUTES_SIGNED',
        message: PRECONDITION_LABELS.SESSIONS_MINUTES_SIGNED,
      },
    ]);
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('audits STATE_CHANGE with the previous and the new status in the same transaction', async () => {
    const planned = makeExecution('PLANNED');
    repository.findByIdForUpdate.mockResolvedValue(planned);
    scheduleProvider.evaluate.mockResolvedValue([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
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
      before: planned.snapshot(),
      after: {
        ...planned.snapshot(),
        status: 'IN_PROGRESS',
      },
    });
  });

  it('denies a user without ejecucion.avanzar', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute({ executionId: 'exec-1', actorId: 'user-2' })).rejects.toThrow(
      ForbiddenError,
    );
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(repository.findByIdForUpdate).not.toHaveBeenCalled();
  });

  it('fails with 404 when the execution does not exist', async () => {
    repository.findByIdForUpdate.mockResolvedValue(null);

    await expect(useCase.execute({ executionId: 'missing', actorId: 'user-2' })).rejects.toThrow(
      ScheduleExecutionNotFoundError,
    );
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails when the execution is closed or voided', async () => {
    for (const status of ['PENDING_APPROVAL', 'CLOSED', 'VOIDED'] as const) {
      repository.findByIdForUpdate.mockResolvedValue(makeExecution(status));

      await expect(useCase.execute({ executionId: 'exec-1', actorId: 'user-2' })).rejects.toThrow(
        InvalidExecutionTransitionError,
      );
    }
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('fails when the status changed between the lock and the update', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('PLANNED'));
    scheduleProvider.evaluate.mockResolvedValue([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'MET',
      },
    ]);
    repository.updateStatus.mockRejectedValue(new ExecutionStatusConflictError());

    await expect(useCase.execute({ executionId: 'exec-1', actorId: 'user-2' })).rejects.toThrow(
      ExecutionStatusConflictError,
    );
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('does not audit or write when a precondition is unmet', async () => {
    repository.findByIdForUpdate.mockResolvedValue(makeExecution('PLANNED'));
    scheduleProvider.evaluate.mockResolvedValue([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'UNMET',
      },
    ]);

    await expect(useCase.execute({ executionId: 'exec-1', actorId: 'user-2' })).rejects.toThrow(
      ExecutionPreconditionsNotMetError,
    );
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('locks the row before evaluating preconditions', async () => {
    const order: string[] = [];
    repository.findByIdForUpdate.mockImplementation(async () => {
      order.push('lock');
      return makeExecution('PLANNED');
    });
    scheduleProvider.evaluate.mockImplementation(async () => {
      order.push('evaluate');
      return [
        {
          code: 'SCHEDULE_HAS_ACTIVITY',
          label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
          state: 'MET',
        },
      ];
    });
    repository.updateStatus.mockImplementation(async () => {
      order.push('update');
    });
    auditLogger.log.mockImplementation(async () => {
      order.push('audit');
    });

    await useCase.execute({ executionId: 'exec-1', actorId: 'user-2' });

    expect(order).toEqual(['lock', 'evaluate', 'update', 'audit']);
  });
});
