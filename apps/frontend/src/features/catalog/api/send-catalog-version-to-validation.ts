import { catalogVersionDtoSchema, type CatalogVersionDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Envía una versión en Borrador a validación (HU-015); el servidor revalida las precondiciones. */
export async function sendCatalogVersionToValidation(
  versionId: string,
): Promise<CatalogVersionDto> {
  const response = await apiClient.post<unknown>(
    `/catalog-versions/${encodeURIComponent(versionId)}/validation`,
  );
  return catalogVersionDtoSchema.parse(response.data);
}
