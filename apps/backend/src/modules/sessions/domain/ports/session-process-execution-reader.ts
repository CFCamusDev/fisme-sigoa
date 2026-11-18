import type { SessionProcessExecutionRef } from '../policies/session-execution-rule.js';

export interface SessionProcessExecutionReader {
  findByIds(ids: readonly string[]): Promise<readonly SessionProcessExecutionRef[]>;
}
