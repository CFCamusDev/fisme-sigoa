import { describe, expect, it } from 'vitest';
import { EXECUTION_PRECONDITION_CODES } from '../entities/process-execution-precondition.js';
import { getExecutionBoardPendingTarget, summarizeSchedule } from './execution-board-targets.js';

describe('execution-board-targets policy', () => {
  it('maps every precondition code to its board target', () => {
    const mapped = Object.fromEntries(
      EXECUTION_PRECONDITION_CODES.map((code) => [code, getExecutionBoardPendingTarget(code)]),
    );

    expect(mapped).toEqual({
      SCHEDULE_HAS_ACTIVITY: 'SCHEDULE',
      SESSIONS_SURVEYS_CLOSED: 'SURVEYS',
      SESSIONS_MINUTES_SIGNED: 'MINUTES',
      MEASUREMENTS_REVIEWED: 'MEASUREMENTS',
      CONSOLIDATION_MINUTES_SIGNED: 'MINUTES',
      RESULTS_CALCULATED: 'RESULTS',
      IMPROVEMENT_ACTIONS_REGISTERED: 'IMPROVEMENT_PLAN',
      RESOLUTION_APPROVED: 'IMPROVEMENT_PLAN',
    });
  });

  it('returns zeros for an empty schedule', () => {
    expect(summarizeSchedule([], '2027-03-15')).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      overdue: 0,
      progressPercent: 0,
    });
  });

  it('counts statuses, overdue activities and rounds progressPercent', () => {
    const summary = summarizeSchedule(
      [
        { status: 'COMPLETED', endDate: '2027-03-01' },
        { status: 'IN_PROGRESS', endDate: '2027-03-10' },
        { status: 'PENDING', endDate: '2027-03-14' },
        { status: 'PENDING', endDate: '2027-03-20' },
        { status: 'IN_PROGRESS', endDate: null },
        { status: 'COMPLETED', endDate: '2027-03-05' },
      ],
      '2027-03-15',
    );

    expect(summary).toEqual({
      total: 6,
      completed: 2,
      inProgress: 2,
      pending: 2,
      overdue: 2,
      progressPercent: 33,
    });
  });
});
