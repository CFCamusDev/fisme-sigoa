import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ProcessExecution } from '../domain/entities/process-execution.js';
import { PRECONDITION_LABELS } from '../domain/entities/process-execution-precondition.js';
import type { ExecutionPreconditionProvider } from '../domain/ports/execution-precondition-provider.js';
import { ExecutionPreconditionEvaluator } from './execution-precondition-evaluator.js';

const NOW = new Date('2027-01-10T10:00:00.000Z');

function makeExecution(status: 'PLANNED' | 'IN_PROGRESS') {
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
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('ExecutionPreconditionEvaluator', () => {
  it('queries only the providers that cover the required codes', async () => {
    const scheduleProvider = mock<ExecutionPreconditionProvider>({
      codes: ['SCHEDULE_HAS_ACTIVITY'],
    });
    const minutesProvider = mock<ExecutionPreconditionProvider>({
      codes: ['SESSIONS_MINUTES_SIGNED'],
    });

    scheduleProvider.evaluate.mockResolvedValue([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'MET',
      },
    ]);

    const evaluator = new ExecutionPreconditionEvaluator([scheduleProvider, minutesProvider]);
    const result = await evaluator.evaluate(makeExecution('PLANNED'));

    expect(result.allMet).toBe(true);
    expect(scheduleProvider.evaluate).toHaveBeenCalledTimes(1);
    expect(minutesProvider.evaluate).not.toHaveBeenCalled();
  });

  it('marks a code without provider as not verifiable', async () => {
    const minutesProvider = mock<ExecutionPreconditionProvider>({
      codes: ['SESSIONS_MINUTES_SIGNED'],
    });
    minutesProvider.evaluate.mockResolvedValue([
      {
        code: 'SESSIONS_MINUTES_SIGNED',
        label: PRECONDITION_LABELS.SESSIONS_MINUTES_SIGNED,
        state: 'MET',
      },
    ]);

    const evaluator = new ExecutionPreconditionEvaluator([minutesProvider]);
    const result = await evaluator.evaluate(makeExecution('IN_PROGRESS'));

    expect(result.allMet).toBe(false);
    expect(result.unmet).toEqual([
      {
        code: 'SESSIONS_SURVEYS_CLOSED',
        label: PRECONDITION_LABELS.SESSIONS_SURVEYS_CLOSED,
        state: 'NOT_VERIFIABLE',
      },
    ]);
  });
});
