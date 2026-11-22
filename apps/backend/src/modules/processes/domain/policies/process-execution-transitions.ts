import {
  PRECONDITION_LABELS,
  type ExecutionPreconditionCode,
  type ExecutionPreconditionResult,
} from '../entities/process-execution-precondition.js';
import type { ProcessExecutionStatus } from '../entities/process-execution-status.js';
import type { ProcessType } from '../entities/process-type.js';

export const ADVANCE_TRANSITIONS: Partial<Record<ProcessExecutionStatus, ProcessExecutionStatus>> =
  {
    PLANNED: 'IN_PROGRESS',
    IN_PROGRESS: 'CONSOLIDATING',
    CONSOLIDATING: 'PENDING_APPROVAL',
  };

export function nextAdvanceStatus(status: ProcessExecutionStatus): ProcessExecutionStatus | null {
  return ADVANCE_TRANSITIONS[status] ?? null;
}

export function closeTargetStatus(status: ProcessExecutionStatus): 'CLOSED' | null {
  return status === 'PENDING_APPROVAL' ? 'CLOSED' : null;
}

export const VOIDABLE_EXECUTION_STATUSES: readonly ProcessExecutionStatus[] = [
  'PLANNED',
  'IN_PROGRESS',
  'CONSOLIDATING',
  'PENDING_APPROVAL',
];

export function canVoid(status: ProcessExecutionStatus): boolean {
  return VOIDABLE_EXECUTION_STATUSES.includes(status);
}

export function requiredPreconditions(
  type: ProcessType,
  from: ProcessExecutionStatus,
): readonly ExecutionPreconditionCode[] {
  if (from === 'PLANNED') {
    return ['SCHEDULE_HAS_ACTIVITY'];
  }
  if (from === 'IN_PROGRESS') {
    if (type === 'P622') {
      return ['MEASUREMENTS_REVIEWED'];
    }
    return ['SESSIONS_SURVEYS_CLOSED', 'SESSIONS_MINUTES_SIGNED'];
  }
  if (from === 'CONSOLIDATING') {
    return ['CONSOLIDATION_MINUTES_SIGNED', 'RESULTS_CALCULATED', 'IMPROVEMENT_ACTIONS_REGISTERED'];
  }
  if (from === 'PENDING_APPROVAL') {
    return ['RESOLUTION_APPROVED'];
  }
  return [];
}

export interface EvaluatedPreconditions {
  readonly allMet: boolean;
  readonly items: readonly ExecutionPreconditionResult[];
  readonly unmet: readonly ExecutionPreconditionResult[];
}

export function evaluatePreconditions(
  required: readonly ExecutionPreconditionCode[],
  results: readonly ExecutionPreconditionResult[],
): EvaluatedPreconditions {
  const byCode = new Map<ExecutionPreconditionCode, ExecutionPreconditionResult>(
    results.map((item) => [item.code, item]),
  );

  const items: ExecutionPreconditionResult[] = required.map((code) => {
    const found = byCode.get(code);
    if (!found) {
      return {
        code,
        label: PRECONDITION_LABELS[code],
        state: 'NOT_VERIFIABLE',
      };
    }
    return {
      code,
      label: found.label || PRECONDITION_LABELS[code],
      state: found.state,
    };
  });

  const unmet = items.filter((item) => item.state !== 'MET');

  return {
    allMet: unmet.length === 0,
    items,
    unmet,
  };
}
