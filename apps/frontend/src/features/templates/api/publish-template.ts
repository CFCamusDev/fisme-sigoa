import {
  templateVersionDtoSchema,
  type PublishTemplateRequest,
  type TemplateVersionDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Publica el Borrador revisado; la versión Publicada anterior queda Obsoleta (HU-018, CA2). */
export async function publishTemplate(
  templateId: string,
  input: PublishTemplateRequest,
): Promise<TemplateVersionDto> {
  const response = await apiClient.post<unknown>(
    `/templates/${encodeURIComponent(templateId)}/publish`,
    input,
  );
  return templateVersionDtoSchema.parse(response.data);
}
