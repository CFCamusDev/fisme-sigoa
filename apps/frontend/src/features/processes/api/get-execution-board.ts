import { executionBoardResponseSchema, type ExecutionBoardResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Consulta el tablero de lectura de una ejecución de proceso (HU-031). */
export async function getExecutionBoard(executionId: string): Promise<ExecutionBoardResponse> {
  const response = await apiClient.get<unknown>(`/process-executions/${executionId}/board`);
  return executionBoardResponseSchema.parse(response.data);
}
