import {
  closeProcessExecutionResponseSchema,
  type CloseProcessExecutionResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Cierra una ejecución de proceso en estado En aprobación. */
export async function closeProcessExecution(
  executionId: string,
): Promise<CloseProcessExecutionResponse> {
  const response = await apiClient.post<unknown>(`/process-executions/${executionId}/close`);
  return closeProcessExecutionResponseSchema.parse(response.data);
}
