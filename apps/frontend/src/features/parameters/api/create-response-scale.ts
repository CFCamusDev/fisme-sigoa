import {
  createResponseScaleRequestSchema,
  responseScaleDtoSchema,
  type CreateResponseScaleRequest,
  type ResponseScaleDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function createResponseScale(
  body: CreateResponseScaleRequest,
): Promise<ResponseScaleDto> {
  const validatedBody = createResponseScaleRequestSchema.parse(body);
  const response = await apiClient.post<unknown>('/response-scales', validatedBody);
  return responseScaleDtoSchema.parse(response.data);
}
