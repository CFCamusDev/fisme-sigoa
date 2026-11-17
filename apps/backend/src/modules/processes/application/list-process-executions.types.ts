import type { ProcessExecutionStatus } from '../domain/entities/process-execution-status.js';
import type { ProcessType } from '../domain/entities/process-type.js';

export interface ListProcessExecutionsCommand {
  readonly actorId: string;
  readonly type?: ProcessType;
  readonly year?: number;
  readonly status?: ProcessExecutionStatus;
  readonly page: number;
  readonly pageSize: number;
}
