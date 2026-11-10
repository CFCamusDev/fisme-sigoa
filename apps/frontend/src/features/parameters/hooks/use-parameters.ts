import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ParametersResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getParameters } from '../api/get-parameters';
import { parameterKeys } from './parameter-keys';

export function useParameters(
  semesterCode?: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<ParametersResponse, ApiError> {
  return useQuery<ParametersResponse, ApiError>({
    queryKey: parameterKeys.list(semesterCode),
    queryFn: () => getParameters(semesterCode),
    staleTime: 30_000,
    retry: false,
    enabled: options.enabled ?? true,
  });
}
