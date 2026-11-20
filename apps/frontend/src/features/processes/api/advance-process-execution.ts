import {
  advanceProcessExecutionResponseSchema,
  type AdvanceProcessExecutionResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Avanza la ejecución al siguiente estado válido de su ciclo de vida. */
export async function advanceProcessExecution(
  executionId: string,
): Promise<AdvanceProcessExecutionResponse> {
  const response = await apiClient.post<unknown>(`/process-executions/${executionId}/advance`);
  return advanceProcessExecutionResponseSchema.parse(response.data);
}
