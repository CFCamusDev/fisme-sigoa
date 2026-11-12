import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListCatalogVersionsResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getCatalogVersions } from '../api/get-catalog-versions';
import { catalogKeys } from './catalog-keys';

export function useCatalogVersions(): UseQueryResult<ListCatalogVersionsResponse, ApiError> {
  return useQuery<ListCatalogVersionsResponse, ApiError>({
    queryKey: catalogKeys.list(),
    queryFn: () => getCatalogVersions(),
    staleTime: 30_000,
    retry: false,
  });
}
