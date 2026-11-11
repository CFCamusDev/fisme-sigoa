import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListResponseScalesQuery, ResponseScalesResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getResponseScales } from '../api/get-response-scales';
import { responseScaleKeys } from './response-scale-keys';

export function useResponseScales(
  type?: ListResponseScalesQuery['type'],
  options: { enabled?: boolean } = {},
): UseQueryResult<ResponseScalesResponse, ApiError> {
  return useQuery<ResponseScalesResponse, ApiError>({
    queryKey: responseScaleKeys.list(type),
    queryFn: () => getResponseScales(type),
    staleTime: 30_000,
    retry: false,
    enabled: options.enabled ?? true,
  });
}
