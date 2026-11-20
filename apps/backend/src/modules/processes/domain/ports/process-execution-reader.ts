import type { ProcessExecution } from '../entities/process-execution.js';
import type { ProcessExecutionStatus } from '../entities/process-execution-status.js';
import type { ProcessType } from '../entities/process-type.js';

export interface ListProcessExecutionsFilter {
  readonly type?: ProcessType;
  readonly year?: number;
  readonly status?: ProcessExecutionStatus;
  readonly page: number;
  readonly pageSize: number;
}

export interface ProcessExecutionReadItem {
  readonly execution: ProcessExecution;
  readonly semesterCode: string | null;
  readonly catalogVersionNumber: number;
}

export interface ProcessExecutionPage {
  readonly items: ProcessExecutionReadItem[];
  readonly total: number;
}

export interface ProcessExecutionReader {
  list(filter: ListProcessExecutionsFilter): Promise<ProcessExecutionPage>;
  existsById(id: string): Promise<boolean>;
}
