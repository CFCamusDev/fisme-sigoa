import { listCatalogVersionsResponseSchema, type ListCatalogVersionsResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Versiones del catálogo del programa, de la más reciente a la más antigua, con sus conteos. */
export async function getCatalogVersions(): Promise<ListCatalogVersionsResponse> {
  const response = await apiClient.get<unknown>('/catalog-versions');
  return listCatalogVersionsResponseSchema.parse(response.data);
}
