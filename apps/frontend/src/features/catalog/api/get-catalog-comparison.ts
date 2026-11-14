import { catalogComparisonDtoSchema, type CatalogComparisonDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Diferencias entre dos versiones del catálogo, con su resolución y vigencia (HU-017). */
export async function getCatalogComparison(
  baseId: string,
  targetId: string,
): Promise<CatalogComparisonDto> {
  const response = await apiClient.get<unknown>(
    `/catalog-versions/${encodeURIComponent(baseId)}/compare/${encodeURIComponent(targetId)}`,
  );
  return catalogComparisonDtoSchema.parse(response.data);
}
