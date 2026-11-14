import {
  listTemplatesResponseSchema,
  type ListTemplatesQuery,
  type ListTemplatesResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type GetTemplatesParams = Partial<ListTemplatesQuery>;

/** Plantillas oficiales por código, con su versión Publicada y su Borrador (HU-018, CA1). */
export async function getTemplates(
  params: GetTemplatesParams = {},
): Promise<ListTemplatesResponse> {
  const response = await apiClient.get<unknown>('/templates', { params });
  return listTemplatesResponseSchema.parse(response.data);
}
