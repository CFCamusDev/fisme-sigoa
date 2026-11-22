import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CloseProcessExecutionResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { closeProcessExecution } from '../api/close-process-execution';
import { processExecutionKeys } from './process-execution-keys';

export function useCloseProcessExecution(
  executionId: string,
): UseMutationResult<CloseProcessExecutionResponse, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation<CloseProcessExecutionResponse, ApiError, void>({
    mutationFn: () =>
      shareInFlight(`close-execution:${executionId}`, () => closeProcessExecution(executionId)),
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
