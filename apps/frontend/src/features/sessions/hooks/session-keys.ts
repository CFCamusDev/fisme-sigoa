import type { GetExecutionSessionsParams } from '../api/get-execution-sessions';

export const sessionKeys = {
  all: ['sessions'] as const,
  byExecution: (executionId: string, params: GetExecutionSessionsParams = {}) =>
    [...sessionKeys.all, 'by-execution', executionId, params] as const,
  attendees: (sessionId: string) => [...sessionKeys.all, 'attendees', sessionId] as const,
};
