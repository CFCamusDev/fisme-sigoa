import type { ProcessExecutionStatus } from '../entities/process-execution-status.js';
import { ScheduleExecutionClosedError } from '../errors/schedule-execution-closed-error.js';
import { isExecutionFrozen } from './execution-immutability.js';

export function assertScheduleEditable(status: ProcessExecutionStatus): void {
  if (isExecutionFrozen(status)) {
    throw new ScheduleExecutionClosedError(status);
  }
}
