import type { ProcessExecutionStatus } from '../entities/process-execution-status.js';
import { ScheduleExecutionClosedError } from '../errors/schedule-execution-closed-error.js';

export function assertScheduleEditable(status: ProcessExecutionStatus): void {
  if (status === 'CLOSED' || status === 'VOIDED') {
    throw new ScheduleExecutionClosedError(status);
  }
}
