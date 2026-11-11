import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ResponseScaleDto, UpdateResponseScaleRequest } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { updateResponseScale } from '../api/update-response-scale';
import { responseScaleKeys } from './response-scale-keys';

export interface UpdateResponseScaleVariables {
  readonly id: string;
  readonly body: UpdateResponseScaleRequest;
}

export function useUpdateResponseScale(): UseMutationResult<
  ResponseScaleDto,
  ApiError,
  UpdateResponseScaleVariables
> {
  const queryClient = useQueryClient();

  return useMutation<ResponseScaleDto, ApiError, UpdateResponseScaleVariables>({
    mutationFn: ({ id, body }) => updateResponseScale(id, body),
    retry: false,
    // También tras un 409 (escala que pasó a «en uso»): recarga para mostrar el estado real (D35).
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: responseScaleKeys.all });
    },
  });
}
