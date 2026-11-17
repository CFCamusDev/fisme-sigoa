import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CreateProcessExecutionRequest, ProcessExecutionDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { createProcessExecution } from '../api/create-process-execution';
import { processExecutionKeys } from './process-execution-keys';

function buildCreateExecutionKey(input: CreateProcessExecutionRequest): string {
  const normalized = {
    type: input.type,
    year: input.year,
    semesterId: input.semesterId ?? null,
    catalogVersionId: input.catalogVersionId,
    name: input.name?.trim() || null,
  };
  return `create-process-execution:${JSON.stringify(normalized)}`;
}

export function useCreateProcessExecution(): UseMutationResult<
  ProcessExecutionDto,
  ApiError,
  CreateProcessExecutionRequest
> {
  const queryClient = useQueryClient();

  return useMutation<ProcessExecutionDto, ApiError, CreateProcessExecutionRequest>({
    mutationFn: (input) =>
      shareInFlight(buildCreateExecutionKey(input), () => createProcessExecution(input)),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: processExecutionKeys.all });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: processExecutionKeys.all });
      }
    },
  });
}
