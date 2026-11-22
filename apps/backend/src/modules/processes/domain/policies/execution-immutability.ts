import type { ProcessExecutionStatus } from '../entities/process-execution-status.js';
import { ExecutionContentFrozenError } from '../errors/execution-content-frozen-error.js';

export const FROZEN_EXECUTION_STATUSES = ['CLOSED', 'VOIDED'] as const;

export type FrozenExecutionStatus = (typeof FROZEN_EXECUTION_STATUSES)[number];

export function isExecutionFrozen(status: ProcessExecutionStatus): status is FrozenExecutionStatus {
  return status === 'CLOSED' || status === 'VOIDED';
}

export function assertExecutionContentEditable(status: ProcessExecutionStatus): void {
  if (isExecutionFrozen(status)) {
    throw new ExecutionContentFrozenError(status);
  }
}
