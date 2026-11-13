import {
  catalogAttributesResponseSchema,
  catalogObjectivesResponseSchema,
  type CatalogAttributesResponse,
  type CatalogObjectivesResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type CatalogItemKind = 'OBJECTIVES' | 'ATTRIBUTES';

const PATH_BY_KIND: Record<CatalogItemKind, string> = {
  OBJECTIVES: 'objectives',
  ATTRIBUTES: 'attributes',
};

/** Fija el orden con la lista completa de ids en el orden nuevo; devuelve la lista del tipo. */
export async function reorderCatalogItems(
  kind: 'OBJECTIVES',
  versionId: string,
  orderedIds: readonly string[],
): Promise<CatalogObjectivesResponse>;
export async function reorderCatalogItems(
  kind: 'ATTRIBUTES',
  versionId: string,
  orderedIds: readonly string[],
): Promise<CatalogAttributesResponse>;
export async function reorderCatalogItems(
  kind: CatalogItemKind,
  versionId: string,
  orderedIds: readonly string[],
): Promise<CatalogObjectivesResponse | CatalogAttributesResponse> {
  const response = await apiClient.put<unknown>(
    `/catalog-versions/${encodeURIComponent(versionId)}/${PATH_BY_KIND[kind]}`,
    { operation: 'REORDER', orderedIds },
  );
  return kind === 'OBJECTIVES'
    ? catalogObjectivesResponseSchema.parse(response.data)
    : catalogAttributesResponseSchema.parse(response.data);
}
