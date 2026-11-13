import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CatalogVersionDetailDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getCatalogVersionDetail } from '../api/get-catalog-version-detail';
import { catalogKeys } from './catalog-keys';

export function useCatalogVersionDetail(
  versionId: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<CatalogVersionDetailDto, ApiError> {
  return useQuery<CatalogVersionDetailDto, ApiError>({
    queryKey: catalogKeys.detail(versionId),
    queryFn: () => getCatalogVersionDetail(versionId),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
    retry: false,
  });
}
