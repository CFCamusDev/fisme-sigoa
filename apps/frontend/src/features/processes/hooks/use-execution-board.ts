import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ExecutionBoardResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getExecutionBoard } from '../api/get-execution-board';
import { processExecutionKeys } from './process-execution-keys';

export function useExecutionBoard(
  executionId: string,
): UseQueryResult<ExecutionBoardResponse, ApiError> {
  return useQuery<ExecutionBoardResponse, ApiError>({
    queryKey: processExecutionKeys.board(executionId),
    queryFn: () => getExecutionBoard(executionId),
    enabled: executionId.length > 0,
  });
}
