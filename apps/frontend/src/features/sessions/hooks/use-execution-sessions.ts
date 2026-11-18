import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListSessionsResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import {
  getExecutionSessions,
  type GetExecutionSessionsParams,
} from '../api/get-execution-sessions';
import { sessionKeys } from './session-keys';

export function useExecutionSessions(
  executionId: string | undefined,
  params: GetExecutionSessionsParams = {},
): UseQueryResult<ListSessionsResponse, ApiError> {
  return useQuery<ListSessionsResponse, ApiError>({
    queryKey: sessionKeys.byExecution(executionId ?? '', params),
    queryFn: () => getExecutionSessions(executionId!, params),
    enabled: Boolean(executionId),
    staleTime: 30_000,
    retry: false,
  });
}
