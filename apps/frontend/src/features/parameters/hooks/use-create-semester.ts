import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CreateSemesterRequest, SemesterDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { createSemester } from '../api/create-semester';
import { semesterKeys } from './semester-keys';

export function useCreateSemester(): UseMutationResult<
  SemesterDto,
  ApiError,
  CreateSemesterRequest
> {
  const queryClient = useQueryClient();

  return useMutation<SemesterDto, ApiError, CreateSemesterRequest>({
    mutationFn: (body) => createSemester(body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: semesterKeys.all });
    },
  });
}
