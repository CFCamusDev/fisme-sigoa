import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type {
  CatalogAttributesResponse,
  CatalogObjectivesResponse,
  CatalogVersionDetailDto,
} from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { reorderCatalogItems, type CatalogItemKind } from '../api/reorder-catalog-items';
import { shareInFlight } from '@/lib/shared-in-flight';
import { catalogKeys } from './catalog-keys';
import { applyItemsToDetail } from './use-save-catalog-item';

type ReorderResult<K extends CatalogItemKind> = K extends 'OBJECTIVES'
  ? CatalogObjectivesResponse
  : CatalogAttributesResponse;

/**
 * Reordena los OE o los AG con la lista completa de ids. Un orden desfasado (409) recarga el
 * detalle para mostrar el estado real.
 */
export function useReorderCatalogItems<K extends CatalogItemKind>(
  kind: K,
  versionId: string,
): UseMutationResult<ReorderResult<K>, ApiError, readonly string[]> {
  const queryClient = useQueryClient();

  return useMutation<ReorderResult<K>, ApiError, readonly string[]>({
    mutationFn: (orderedIds) =>
      shareInFlight(`reorder:${kind}:${versionId}:${orderedIds.join(',')}`, () =>
        kind === 'OBJECTIVES'
          ? reorderCatalogItems('OBJECTIVES', versionId, orderedIds)
          : reorderCatalogItems('ATTRIBUTES', versionId, orderedIds),
      ) as Promise<ReorderResult<K>>,
    retry: false,
    onSuccess: (response) => {
      queryClient.setQueryData<CatalogVersionDetailDto>(catalogKeys.detail(versionId), (detail) =>
        applyItemsToDetail(detail, kind, response),
      );
      void queryClient.invalidateQueries({ queryKey: catalogKeys.list() });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: catalogKeys.detail(versionId) });
      }
    },
  });
}
