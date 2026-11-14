import {
  listResolutionsResponseSchema,
  type ListResolutionsQuery,
  type ListResolutionsResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type GetResolutionsParams = Partial<ListResolutionsQuery>;

/** Resoluciones de la más reciente a la más antigua, con filtros y paginación opcionales. */
export async function getResolutions(
  params: GetResolutionsParams = {},
): Promise<ListResolutionsResponse> {
  const response = await apiClient.get<unknown>('/resolutions', { params });
  return listResolutionsResponseSchema.parse(response.data);
}
