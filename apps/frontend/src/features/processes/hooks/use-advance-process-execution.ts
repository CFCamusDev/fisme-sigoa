import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { AdvanceProcessExecutionResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { advanceProcessExecution } from '../api/advance-process-execution';
import { processExecutionKeys } from './process-execution-keys';

export function useAdvanceProcessExecution(
  executionId: string,
): UseMutationResult<AdvanceProcessExecutionResponse, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation<AdvanceProcessExecutionResponse, ApiError, void>({
    mutationFn: () =>
      shareInFlight(`advance-execution:${executionId}`, () => advanceProcessExecution(executionId)),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: processExecutionKeys.nextTransition(executionId),
      });
      void queryClient.invalidateQueries({
        queryKey: [...processExecutionKeys.all, 'list'],
      });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: processExecutionKeys.nextTransition(executionId),
        });
      }
    },
  });
}
