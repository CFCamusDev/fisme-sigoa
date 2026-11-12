import { catalogVersionDtoSchema, type CatalogVersionDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Crea una versión en Borrador copiando la vigente; el servidor resuelve programa y número. */
export async function createCatalogVersion(): Promise<CatalogVersionDto> {
  const response = await apiClient.post<unknown>('/catalog-versions');
  return catalogVersionDtoSchema.parse(response.data);
}
