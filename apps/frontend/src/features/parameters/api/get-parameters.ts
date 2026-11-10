import { parametersResponseSchema, type ParametersResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Valores vigentes con historial; sin `semesterCode` rige el último semestre iniciado hasta hoy. */
export async function getParameters(semesterCode?: string): Promise<ParametersResponse> {
  const response = await apiClient.get<unknown>('/parameters', {
    params: semesterCode ? { semesterCode } : undefined,
  });
  return parametersResponseSchema.parse(response.data);
}
