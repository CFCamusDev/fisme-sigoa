import {
  responseScalesResponseSchema,
  type ListResponseScalesQuery,
  type ResponseScalesResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Catálogo de escalas con sus niveles; `type` filtra por tipo (opcional). */
export async function getResponseScales(
  type?: ListResponseScalesQuery['type'],
): Promise<ResponseScalesResponse> {
  const response = await apiClient.get<unknown>('/response-scales', {
    params: type ? { type } : undefined,
  });
  return responseScalesResponseSchema.parse(response.data);
}
