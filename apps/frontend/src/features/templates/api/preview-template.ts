import {
  previewTemplateResponseSchema,
  type PreviewTemplateRequest,
  type PreviewTemplateResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Genera la vista previa en PDF con datos de ejemplo para el contenido actual del editor (HU-019). */
export async function previewTemplate(
  templateId: string,
  input: PreviewTemplateRequest,
): Promise<PreviewTemplateResponse> {
  const response = await apiClient.post<unknown>(
    `/templates/${encodeURIComponent(templateId)}/preview`,
    input,
  );
  return previewTemplateResponseSchema.parse(response.data);
}
