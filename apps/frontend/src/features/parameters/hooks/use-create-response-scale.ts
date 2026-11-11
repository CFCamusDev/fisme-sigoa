import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CreateResponseScaleRequest, ResponseScaleDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { createResponseScale } from '../api/create-response-scale';
import { responseScaleKeys } from './response-scale-keys';

export function useCreateResponseScale(): UseMutationResult<
  ResponseScaleDto,
  ApiError,
  CreateResponseScaleRequest
> {
  const queryClient = useQueryClient();

  return useMutation<ResponseScaleDto, ApiError, CreateResponseScaleRequest>({
    mutationFn: (body) => createResponseScale(body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: responseScaleKeys.all });
    },
  });
}
