import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListResolutionsResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getResolutions, type GetResolutionsParams } from '../api/get-resolutions';
import { resolutionKeys } from './resolution-keys';

export function useResolutions(
  params: GetResolutionsParams = {},
): UseQueryResult<ListResolutionsResponse, ApiError> {
  return useQuery<ListResolutionsResponse, ApiError>({
    queryKey: resolutionKeys.list(params),
    queryFn: () => getResolutions(params),
    staleTime: 30_000,
    retry: false,
  });
}
