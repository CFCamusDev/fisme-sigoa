import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { ProcessExecution } from '../domain/entities/process-execution.js';
import { PRECONDITION_LABELS } from '../domain/entities/process-execution-precondition.js';
import { ScheduleExecutionNotFoundError } from '../domain/errors/index.js';
import type {
  ExecutionPreconditionProvider,
  ProcessExecutionRepository,
  ProcessPermissionChecker,
} from '../domain/ports/index.js';
import { ExecutionPreconditionEvaluator } from './execution-precondition-evaluator.js';
import { GetNextTransitionUseCase } from './get-next-transition.js';

const CREATED_AT = new Date('2027-01-10T10:00:00.000Z');

function makeExecution(status: 'PLANNED' | 'PENDING_APPROVAL') {
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

describe('GetNextTransitionUseCase (HU-029, T1-D8)', () => {
  let repository: MockProxy<ProcessExecutionRepository>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let scheduleProvider: MockProxy<ExecutionPreconditionProvider>;
  let useCase: GetNextTransitionUseCase;

  beforeEach(() => {
    repository = mock<ProcessExecutionRepository>();
    permissionChecker = mock<ProcessPermissionChecker>();
    scheduleProvider = mock<ExecutionPreconditionProvider>({
      codes: ['SCHEDULE_HAS_ACTIVITY'],
    });

    useCase = new GetNextTransitionUseCase({
      processExecutionRepository: repository,
      permissionChecker,
      preconditionEvaluator: new ExecutionPreconditionEvaluator([scheduleProvider]),
    });
  });

  it('returns the next status and each precondition', async () => {
    repository.findById.mockResolvedValue(makeExecution('PLANNED'));
    scheduleProvider.evaluate.mockResolvedValue([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'MET',
      },
    ]);

    const result = await useCase.execute({ executionId: 'exec-1', actorId: 'user-1' });

    expect(result).toEqual({
      executionId: 'exec-1',
      status: 'PLANNED',
      nextStatus: 'IN_PROGRESS',
      preconditions: [
        {
          code: 'SCHEDULE_HAS_ACTIVITY',
          label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
          state: 'MET',
        },
      ],
      canAdvance: true,
    });
  });

  it('returns null next status from PENDING_APPROVAL', async () => {
    repository.findById.mockResolvedValue(makeExecution('PENDING_APPROVAL'));

    const result = await useCase.execute({ executionId: 'exec-1', actorId: 'user-1' });

    expect(result).toEqual({
      executionId: 'exec-1',
      status: 'PENDING_APPROVAL',
      nextStatus: null,
      preconditions: [],
      canAdvance: false,
    });
    expect(scheduleProvider.evaluate).not.toHaveBeenCalled();
  });

  it('denies a user without ejecucion.ver', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute({ executionId: 'exec-1', actorId: 'user-1' })).rejects.toThrow(
      ForbiddenError,
    );
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('fails with 404 when the execution does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ executionId: 'missing', actorId: 'user-1' })).rejects.toThrow(
      ScheduleExecutionNotFoundError,
    );
  });
});
