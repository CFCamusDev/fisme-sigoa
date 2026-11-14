import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type {
  CatalogAttributesResponse,
  CatalogObjectivesResponse,
  CatalogVersionDetailDto,
} from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import type { CatalogItemKind } from '../api/reorder-catalog-items';
import {
  saveCatalogAttribute,
  type SaveCatalogAttributeInput,
} from '../api/save-catalog-attribute';
import {
  saveCatalogObjective,
  type SaveCatalogObjectiveInput,
} from '../api/save-catalog-objective';
import { shareInFlight } from '@/lib/shared-in-flight';
import { catalogKeys } from './catalog-keys';

type SaveVariables<K extends CatalogItemKind> = K extends 'OBJECTIVES'
  ? SaveCatalogObjectiveInput
  : SaveCatalogAttributeInput;
type SaveResult<K extends CatalogItemKind> = K extends 'OBJECTIVES'
  ? CatalogObjectivesResponse
  : CatalogAttributesResponse;

/** Reemplaza en el detalle en caché la lista del tipo con la respuesta del servidor. */
export function applyItemsToDetail(
  detail: CatalogVersionDetailDto | undefined,
  kind: CatalogItemKind,
  response: CatalogObjectivesResponse | CatalogAttributesResponse,
): CatalogVersionDetailDto | undefined {
  if (!detail) {
    return detail;
  }
  return kind === 'OBJECTIVES'
    ? {
        ...detail,
        objectives: response.items as CatalogVersionDetailDto['objectives'],
        version: { ...detail.version, objectiveCount: response.items.length },
      }
    : {
        ...detail,
        attributes: response.items as CatalogVersionDetailDto['attributes'],
        version: { ...detail.version, attributeCount: response.items.length },
      };
}

/**
 * Agrega o edita un OE o un AG. Sin reintentos automáticos; las llamadas idénticas simultáneas
 * comparten una sola petición. Ante un conflicto o un elemento inexistente se recarga el detalle.
 */
export function useSaveCatalogItem<K extends CatalogItemKind>(
  kind: K,
  versionId: string,
): UseMutationResult<SaveResult<K>, ApiError, SaveVariables<K>> {
  const queryClient = useQueryClient();

  return useMutation<SaveResult<K>, ApiError, SaveVariables<K>>({
    mutationFn: (variables) =>
      shareInFlight(`save:${kind}:${versionId}:${JSON.stringify(variables)}`, () =>
        kind === 'OBJECTIVES'
          ? saveCatalogObjective(versionId, variables as SaveCatalogObjectiveInput)
          : saveCatalogAttribute(versionId, variables as SaveCatalogAttributeInput),
      ) as Promise<SaveResult<K>>,
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
