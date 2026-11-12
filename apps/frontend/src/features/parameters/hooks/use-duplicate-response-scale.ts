import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { DuplicateResponseScaleRequest, ResponseScaleDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { duplicateResponseScale } from '../api/duplicate-response-scale';
import { responseScaleKeys } from './response-scale-keys';

export interface DuplicateResponseScaleVariables {
  readonly id: string;
  readonly body: DuplicateResponseScaleRequest;
}

export function useDuplicateResponseScale(): UseMutationResult<
  ResponseScaleDto,
  ApiError,
  DuplicateResponseScaleVariables
> {
  const queryClient = useQueryClient();

  return useMutation<ResponseScaleDto, ApiError, DuplicateResponseScaleVariables>({
    mutationFn: ({ id, body }) => duplicateResponseScale(id, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: responseScaleKeys.all });
    },
  });
}
