import {
  voidProcessExecutionResponseSchema,
  type VoidProcessExecutionRequest,
  type VoidProcessExecutionResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Anula una ejecución de proceso abierta registrando su motivo. */
export async function voidProcessExecution(
  executionId: string,
  payload: VoidProcessExecutionRequest,
): Promise<VoidProcessExecutionResponse> {
  const response = await apiClient.post<unknown>(
    `/process-executions/${executionId}/void`,
    payload,
  );
  return voidProcessExecutionResponseSchema.parse(response.data);
}
