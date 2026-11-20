import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { NextTransitionResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getNextTransition } from '../api/get-next-transition';
import { processExecutionKeys } from './process-execution-keys';

export function useNextTransition(
  executionId: string,
): UseQueryResult<NextTransitionResponse, ApiError> {
  return useQuery<NextTransitionResponse, ApiError>({
    queryKey: processExecutionKeys.nextTransition(executionId),
    queryFn: () => getNextTransition(executionId),
    enabled: executionId.length > 0,
  });
}
