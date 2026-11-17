import {
  listProcessExecutionsResponseSchema,
  type ListProcessExecutionsQuery,
  type ListProcessExecutionsResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type GetProcessExecutionsParams = Partial<ListProcessExecutionsQuery>;

/** Consulta las ejecuciones de proceso paginadas con filtros opcionales. */
export async function getProcessExecutions(
  params: GetProcessExecutionsParams = {},
): Promise<ListProcessExecutionsResponse> {
  const response = await apiClient.get<unknown>('/process-executions', { params });
  return listProcessExecutionsResponseSchema.parse(response.data);
}
