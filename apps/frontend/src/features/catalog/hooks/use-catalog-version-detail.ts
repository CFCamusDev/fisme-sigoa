import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CatalogVersionDetailDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getCatalogVersionDetail } from '../api/get-catalog-version-detail';
import { catalogKeys } from './catalog-keys';

export function useCatalogVersionDetail(
  versionId: string,
): UseQueryResult<CatalogVersionDetailDto, ApiError> {
  return useQuery<CatalogVersionDetailDto, ApiError>({
    queryKey: catalogKeys.detail(versionId),
    queryFn: () => getCatalogVersionDetail(versionId),
    staleTime: 30_000,
    retry: false,
  });
}
