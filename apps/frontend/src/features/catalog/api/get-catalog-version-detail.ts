import { catalogVersionDetailDtoSchema, type CatalogVersionDetailDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Versión del catálogo con sus OE y AG ordenados. */
export async function getCatalogVersionDetail(versionId: string): Promise<CatalogVersionDetailDto> {
  const response = await apiClient.get<unknown>(
    `/catalog-versions/${encodeURIComponent(versionId)}`,
  );
  return catalogVersionDetailDtoSchema.parse(response.data);
}
