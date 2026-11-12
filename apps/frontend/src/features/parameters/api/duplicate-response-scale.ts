import {
  duplicateResponseScaleRequestSchema,
  responseScaleDtoSchema,
  type DuplicateResponseScaleRequest,
  type ResponseScaleDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function duplicateResponseScale(
  id: string,
  body: DuplicateResponseScaleRequest,
): Promise<ResponseScaleDto> {
  const validatedBody = duplicateResponseScaleRequestSchema.parse(body);
  const response = await apiClient.post<unknown>(
    `/response-scales/${encodeURIComponent(id)}/duplicate`,
    validatedBody,
  );
  return responseScaleDtoSchema.parse(response.data);
}
