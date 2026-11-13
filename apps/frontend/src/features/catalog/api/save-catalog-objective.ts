import {
  catalogObjectivesResponseSchema,
  type CatalogObjectivesResponse,
  type SaveCatalogObjectiveRequest,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type SaveCatalogObjectiveInput = Omit<SaveCatalogObjectiveRequest, 'operation'>;

/** Agrega (sin `id`) o edita (con `id`) un OE; devuelve la lista completa y ordenada. */
export async function saveCatalogObjective(
  versionId: string,
  input: SaveCatalogObjectiveInput,
): Promise<CatalogObjectivesResponse> {
  const response = await apiClient.put<unknown>(
    `/catalog-versions/${encodeURIComponent(versionId)}/objectives`,
    { operation: 'SAVE', ...input },
  );
  return catalogObjectivesResponseSchema.parse(response.data);
}
