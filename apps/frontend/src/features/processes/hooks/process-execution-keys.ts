import type { GetProcessExecutionsParams } from '../api/get-process-executions';

export const processExecutionKeys = {
  all: ['process-executions'] as const,
  list: (params: GetProcessExecutionsParams) =>
    [...processExecutionKeys.all, 'list', params] as const,
};
