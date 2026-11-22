import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { VoidProcessExecutionRequest, VoidProcessExecutionResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { voidProcessExecution } from '../api/void-process-execution';
import { processExecutionKeys } from './process-execution-keys';

export function useVoidProcessExecution(
  executionId: string,
): UseMutationResult<VoidProcessExecutionResponse, ApiError, VoidProcessExecutionRequest> {
  const queryClient = useQueryClient();

  return useMutation<VoidProcessExecutionResponse, ApiError, VoidProcessExecutionRequest>({
    mutationFn: (payload) =>
      shareInFlight(`void-execution:${executionId}`, () =>
        voidProcessExecution(executionId, payload),
      ),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: processExecutionKeys.nextTransition(executionId),
      });
      void queryClient.invalidateQueries({
        queryKey: [...processExecutionKeys.all, 'list'],
      });
      void queryClient.invalidateQueries({
        queryKey: processExecutionKeys.board(executionId),
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
