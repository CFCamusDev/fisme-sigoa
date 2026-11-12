import {
  responseScaleDtoSchema,
  updateResponseScaleRequestSchema,
  type ResponseScaleDto,
  type UpdateResponseScaleRequest,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function updateResponseScale(
  id: string,
  body: UpdateResponseScaleRequest,
): Promise<ResponseScaleDto> {
  const validatedBody = updateResponseScaleRequestSchema.parse(body);
  const response = await apiClient.patch<unknown>(
    `/response-scales/${encodeURIComponent(id)}`,
    validatedBody,
  );
  return responseScaleDtoSchema.parse(response.data);
}
