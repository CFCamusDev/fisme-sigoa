import type { ExecutionPreconditionCode } from '../entities/process-execution-precondition.js';
import type { ScheduleActivityStatus } from '../entities/schedule-activity-status.js';
import { isOverdue } from './schedule-overdue.js';

export type ExecutionBoardPendingTarget =
  'SCHEDULE' | 'SESSIONS' | 'SURVEYS' | 'MINUTES' | 'MEASUREMENTS' | 'RESULTS' | 'IMPROVEMENT_PLAN';

export const EXECUTION_BOARD_PENDING_TARGET_BY_CODE: Readonly<
  Record<ExecutionPreconditionCode, ExecutionBoardPendingTarget>
> = {
  SCHEDULE_HAS_ACTIVITY: 'SCHEDULE',
  SESSIONS_SURVEYS_CLOSED: 'SURVEYS',
  SESSIONS_MINUTES_SIGNED: 'MINUTES',
  MEASUREMENTS_REVIEWED: 'MEASUREMENTS',
  CONSOLIDATION_MINUTES_SIGNED: 'MINUTES',
  RESULTS_CALCULATED: 'RESULTS',
  IMPROVEMENT_ACTIONS_REGISTERED: 'IMPROVEMENT_PLAN',
  // El tablero solo evalúa precondiciones de avance; RESOLUTION_APPROVED es de cierre.
  RESOLUTION_APPROVED: 'IMPROVEMENT_PLAN',
};

export function getExecutionBoardPendingTarget(
  code: ExecutionPreconditionCode,
): ExecutionBoardPendingTarget {
  return EXECUTION_BOARD_PENDING_TARGET_BY_CODE[code];
}

export interface ScheduleSummaryActivity {
  readonly status: ScheduleActivityStatus;
  readonly endDate: string | null;
}

export interface ScheduleSummary {
  readonly total: number;
  readonly completed: number;
  readonly inProgress: number;
  readonly pending: number;
  readonly overdue: number;
  readonly progressPercent: number;
}

export function summarizeSchedule(
  activities: readonly ScheduleSummaryActivity[],
  today: string,
): ScheduleSummary {
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  let overdue = 0;

  for (const activity of activities) {
    if (activity.status === 'COMPLETED') {
      completed += 1;
    } else if (activity.status === 'IN_PROGRESS') {
      inProgress += 1;
    } else {
      pending += 1;
    }

    if (isOverdue(activity, today)) {
      overdue += 1;
    }
  }

  const total = activities.length;
  const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    inProgress,
    pending,
    overdue,
    progressPercent,
  };
}
