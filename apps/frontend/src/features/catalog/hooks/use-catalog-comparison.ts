import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CatalogComparisonDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getCatalogComparison } from '../api/get-catalog-comparison';
import { catalogKeys } from './catalog-keys';

/**
 * Compara dos versiones. Solo consulta cuando hay dos identificadores distintos: sin selección
 * completa, o con la misma versión en ambos lados, no se envía ninguna petición.
 */
export function useCatalogComparison(
  baseId: string | undefined,
  targetId: string | undefined,
): UseQueryResult<CatalogComparisonDto, ApiError> {
  const enabled = Boolean(baseId) && Boolean(targetId) && baseId !== targetId;
  return useQuery<CatalogComparisonDto, ApiError>({
    queryKey: catalogKeys.comparison(baseId ?? '', targetId ?? ''),
    queryFn: () => getCatalogComparison(baseId as string, targetId as string),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}
