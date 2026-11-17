import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListProcessExecutionsResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import {
  getProcessExecutions,
  type GetProcessExecutionsParams,
} from '../api/get-process-executions';
import { processExecutionKeys } from './process-execution-keys';

export function useProcessExecutions(
  params: GetProcessExecutionsParams = {},
): UseQueryResult<ListProcessExecutionsResponse, ApiError> {
  return useQuery<ListProcessExecutionsResponse, ApiError>({
    queryKey: processExecutionKeys.list(params),
    queryFn: () => getProcessExecutions(params),
    staleTime: 30_000,
    retry: false,
  });
}
