import type { ProcessExecutionStatus } from '../entities/process-execution-status.js';
import type { ProcessType } from '../entities/process-type.js';

export interface LockedScheduleExecution {
  readonly id: string;
  readonly status: ProcessExecutionStatus;
  readonly type: ProcessType;
}

export interface ScheduleExecutionLocker {
  lockById(executionId: string): Promise<LockedScheduleExecution | null>;
}
