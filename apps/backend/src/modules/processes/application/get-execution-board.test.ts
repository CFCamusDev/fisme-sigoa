import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { ProcessExecution } from '../domain/entities/process-execution.js';
import { PRECONDITION_LABELS } from '../domain/entities/process-execution-precondition.js';
import type { ProcessExecutionStatus } from '../domain/entities/process-execution-status.js';
import { ScheduleActivity } from '../domain/entities/schedule-activity.js';
import type { ScheduleActivityStatus } from '../domain/entities/schedule-activity-status.js';
import { ScheduleExecutionNotFoundError } from '../domain/errors/index.js';
import type {
  ExecutionBoardSessionsReader,
  ExecutionPreconditionProvider,
  ProcessExecutionReader,
  ProcessPermissionChecker,
  ScheduleActivityRepository,
} from '../domain/ports/index.js';
import { ExecutionPreconditionEvaluator } from './execution-precondition-evaluator.js';
import { GetExecutionBoardUseCase } from './get-execution-board.js';

const CREATED_AT = new Date('2027-01-10T10:00:00.000Z');
const UPDATED_AT = new Date('2027-01-15T12:00:00.000Z');
const FIXED_NOW = new Date('2027-03-15T15:00:00.000Z');

function makeExecution(status: ProcessExecutionStatus) {
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
    updatedAt: UPDATED_AT,
  });
}

function makeActivity(
  id: string,
  number: number,
  status: ScheduleActivityStatus,
  endDate: string | null,
) {
  return ScheduleActivity.rehydrate({
    id,
    processExecutionId: 'exec-1',
    number,
    activity: `Actividad ${number}`,
    responsible: 'Comité de Calidad',
    goal: null,
    indicator: null,
    startDate: null,
    endDate,
    status,
    actualEndDate: status === 'COMPLETED' ? endDate : null,
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  });
}

describe('GetExecutionBoardUseCase (HU-031)', () => {
  let processExecutionReader: MockProxy<ProcessExecutionReader>;
  let scheduleActivityRepository: MockProxy<ScheduleActivityRepository>;
  let boardSessionsReader: MockProxy<ExecutionBoardSessionsReader>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let scheduleProvider: MockProxy<ExecutionPreconditionProvider>;
  let useCase: GetExecutionBoardUseCase;

  beforeEach(() => {
    processExecutionReader = mock<ProcessExecutionReader>();
    scheduleActivityRepository = mock<ScheduleActivityRepository>();
    boardSessionsReader = mock<ExecutionBoardSessionsReader>();
    permissionChecker = mock<ProcessPermissionChecker>();
    scheduleProvider = mock<ExecutionPreconditionProvider>({
      codes: ['SCHEDULE_HAS_ACTIVITY'],
    });

    useCase = new GetExecutionBoardUseCase({
      processExecutionReader,
      scheduleActivityRepository,
      boardSessionsReader,
      permissionChecker,
      preconditionEvaluator: new ExecutionPreconditionEvaluator([scheduleProvider]),
      clock: () => FIXED_NOW,
    });
  });

  it('returns the status, the schedule progress and the sessions of the execution', async () => {
    processExecutionReader.findReadItemById.mockResolvedValue({
      execution: makeExecution('IN_PROGRESS'),
      semesterCode: null,
      catalogVersionNumber: 2,
    });
    scheduleActivityRepository.findByExecutionId.mockResolvedValue([
      makeActivity('act-1', 1, 'COMPLETED', '2027-03-01'),
      makeActivity('act-2', 2, 'IN_PROGRESS', '2027-03-10'),
      makeActivity('act-3', 3, 'PENDING', '2027-03-20'),
    ]);
    boardSessionsReader.summarize.mockResolvedValue({
      total: 2,
      lastSessionDate: '2027-03-12',
      items: [
        {
          id: 'sess-2',
          stakeholderType: 'EMPLOYER',
          sessionDate: '2027-03-12',
          startTime: '15:00',
          modality: 'VIRTUAL',
        },
        {
          id: 'sess-1',
          stakeholderType: 'GRADUATE',
          sessionDate: '2027-03-05',
          startTime: '10:00',
          modality: 'IN_PERSON',
        },
      ],
    });
    scheduleProvider.evaluate.mockResolvedValue([]);

    const result = await useCase.execute({ executionId: 'exec-1', actorId: 'user-1' });

    expect(result.execution).toEqual({
      id: 'exec-1',
      type: 'P612',
      name: 'Medición anual de OE 2027',
      year: 2027,
      semesterId: null,
      semesterCode: null,
      catalogVersionId: 'cv-1',
      catalogVersionNumber: 2,
      status: 'IN_PROGRESS',
      createdAt: CREATED_AT.toISOString(),
      updatedAt: UPDATED_AT.toISOString(),
    });
    expect(result.schedule).toEqual({
      total: 3,
      completed: 1,
      inProgress: 1,
      pending: 1,
      overdue: 1,
      progressPercent: 33,
    });
    expect(result.sessions).toEqual({
      total: 2,
      lastSessionDate: '2027-03-12',
      items: [
        {
          id: 'sess-2',
          stakeholderType: 'EMPLOYER',
          sessionDate: '2027-03-12',
          startTime: '15:00',
          modality: 'VIRTUAL',
        },
        {
          id: 'sess-1',
          stakeholderType: 'GRADUATE',
          sessionDate: '2027-03-05',
          startTime: '10:00',
          modality: 'IN_PERSON',
        },
      ],
    });
    expect(result.nextStatus).toBe('CONSOLIDATING');
    expect(result.generatedAt).toBe(FIXED_NOW.toISOString());
  });

  it('reports surveys, minutes and results as not available yet', async () => {
    processExecutionReader.findReadItemById.mockResolvedValue({
      execution: makeExecution('PLANNED'),
      semesterCode: null,
      catalogVersionNumber: 1,
    });
    scheduleActivityRepository.findByExecutionId.mockResolvedValue([]);
    boardSessionsReader.summarize.mockResolvedValue({
      total: 0,
      lastSessionDate: null,
      items: [],
    });
    scheduleProvider.evaluate.mockResolvedValue([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'UNMET',
      },
    ]);

    const result = await useCase.execute({ executionId: 'exec-1', actorId: 'user-1' });

    expect(result.surveys).toEqual({ available: false });
    expect(result.minutes).toEqual({ available: false });
    expect(result.results).toEqual({ available: false });
  });

  it('lists the unmet preconditions as pending items with their target', async () => {
    processExecutionReader.findReadItemById.mockResolvedValue({
      execution: makeExecution('PLANNED'),
      semesterCode: null,
      catalogVersionNumber: 1,
    });
    scheduleActivityRepository.findByExecutionId.mockResolvedValue([]);
    boardSessionsReader.summarize.mockResolvedValue({
      total: 0,
      lastSessionDate: null,
      items: [],
    });
    scheduleProvider.evaluate.mockResolvedValue([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'UNMET',
      },
    ]);

    const result = await useCase.execute({ executionId: 'exec-1', actorId: 'user-1' });

    expect(result.nextStatus).toBe('IN_PROGRESS');
    expect(result.pending).toEqual([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'UNMET',
        target: 'SCHEDULE',
      },
    ]);
  });

  it('returns no pending items and no next status for a closed execution', async () => {
    processExecutionReader.findReadItemById.mockResolvedValue({
      execution: makeExecution('CLOSED'),
      semesterCode: null,
      catalogVersionNumber: 1,
    });
    scheduleActivityRepository.findByExecutionId.mockResolvedValue([]);
    boardSessionsReader.summarize.mockResolvedValue({
      total: 0,
      lastSessionDate: null,
      items: [],
    });

    const result = await useCase.execute({ executionId: 'exec-1', actorId: 'user-1' });

    expect(result.nextStatus).toBeNull();
    expect(result.pending).toEqual([]);
    expect(scheduleProvider.evaluate).not.toHaveBeenCalled();
  });

  it('returns zeros for an execution without activities or sessions', async () => {
    processExecutionReader.findReadItemById.mockResolvedValue({
      execution: makeExecution('PLANNED'),
      semesterCode: null,
      catalogVersionNumber: 1,
    });
    scheduleActivityRepository.findByExecutionId.mockResolvedValue([]);
    boardSessionsReader.summarize.mockResolvedValue({
      total: 0,
      lastSessionDate: null,
      items: [],
    });
    scheduleProvider.evaluate.mockResolvedValue([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'MET',
      },
    ]);

    const result = await useCase.execute({ executionId: 'exec-1', actorId: 'user-1' });

    expect(result.schedule).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      overdue: 0,
      progressPercent: 0,
    });
    expect(result.sessions).toEqual({
      total: 0,
      lastSessionDate: null,
      items: [],
    });
    expect(result.pending).toEqual([]);
  });

  it('rejects an actor without ejecucion.ver', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(useCase.execute({ executionId: 'exec-1', actorId: 'user-2' })).rejects.toThrow(
      ForbiddenError,
    );
    expect(processExecutionReader.findReadItemById).not.toHaveBeenCalled();
  });

  it('throws not found for an unknown execution', async () => {
    processExecutionReader.findReadItemById.mockResolvedValue(null);

    await expect(useCase.execute({ executionId: 'missing', actorId: 'user-1' })).rejects.toThrow(
      ScheduleExecutionNotFoundError,
    );
  });
});
