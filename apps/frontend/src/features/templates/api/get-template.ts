import { templateDetailDtoSchema, type TemplateDetailDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Detalle de una plantilla: variables, historial y contenido de la Publicada y el Borrador. */
export async function getTemplate(templateId: string): Promise<TemplateDetailDto> {
  const response = await apiClient.get<unknown>(`/templates/${encodeURIComponent(templateId)}`);
  return templateDetailDtoSchema.parse(response.data);
}
