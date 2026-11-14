import {
  templateVersionDtoSchema,
  type SaveTemplateDraftRequest,
  type TemplateVersionDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Guarda el HTML como Borrador: crea la versión siguiente (201) o actualiza el existente (200). */
export async function saveTemplateDraft(
  templateId: string,
  input: SaveTemplateDraftRequest,
): Promise<TemplateVersionDto> {
  const response = await apiClient.put<unknown>(
    `/templates/${encodeURIComponent(templateId)}/draft`,
    input,
  );
  return templateVersionDtoSchema.parse(response.data);
}
