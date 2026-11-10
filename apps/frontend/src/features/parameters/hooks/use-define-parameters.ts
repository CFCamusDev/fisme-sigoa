import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { DefineParametersRequest, ParametersResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { defineParameters } from '../api/define-parameters';
import { parameterKeys } from './parameter-keys';

export function useDefineParameters(): UseMutationResult<
  ParametersResponse,
  ApiError,
  DefineParametersRequest
> {
  const queryClient = useQueryClient();

  return useMutation<ParametersResponse, ApiError, DefineParametersRequest>({
    mutationFn: (body) => defineParameters(body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parameterKeys.all });
    },
  });
}
