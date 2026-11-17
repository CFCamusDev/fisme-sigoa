import type { ProcessExecution } from '../entities/process-execution.js';

export interface ProcessExecutionRepository {
  save(execution: ProcessExecution): Promise<void>;
}
