import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ProgramDto, UpdateProgramRequest } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { updateProgram } from '../api/update-program';
import { programKeys } from './program-keys';

export function useUpdateProgram(): UseMutationResult<ProgramDto, ApiError, UpdateProgramRequest> {
  const queryClient = useQueryClient();

  return useMutation<ProgramDto, ApiError, UpdateProgramRequest>({
    mutationFn: (body) => updateProgram(body),
    retry: false,
    onSuccess: (updatedProgram) => {
      queryClient.setQueryData(programKeys.all, updatedProgram);
    },
  });
}
