import {
  catalogAttributesResponseSchema,
  type CatalogAttributesResponse,
  type SaveCatalogAttributeRequest,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type SaveCatalogAttributeInput = Omit<SaveCatalogAttributeRequest, 'operation'>;

/** Agrega (sin `id`) o edita (con `id`) un AG; devuelve la lista completa y ordenada. */
export async function saveCatalogAttribute(
  versionId: string,
  input: SaveCatalogAttributeInput,
): Promise<CatalogAttributesResponse> {
  const response = await apiClient.put<unknown>(
    `/catalog-versions/${encodeURIComponent(versionId)}/attributes`,
    { operation: 'SAVE', ...input },
  );
  return catalogAttributesResponseSchema.parse(response.data);
}
