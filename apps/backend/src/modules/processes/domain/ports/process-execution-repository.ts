import type { ProcessExecution } from '../entities/process-execution.js';
import type { ProcessExecutionStatus } from '../entities/process-execution-status.js';

export interface ProcessExecutionRepository {
  save(execution: ProcessExecution): Promise<void>;
  findById(id: string): Promise<ProcessExecution | null>;
  findByIdForUpdate(id: string): Promise<ProcessExecution | null>;
  updateStatus(execution: ProcessExecution, expectedStatus: ProcessExecutionStatus): Promise<void>;
}
