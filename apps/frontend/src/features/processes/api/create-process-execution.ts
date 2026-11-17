import {
  processExecutionDtoSchema,
  type CreateProcessExecutionRequest,
  type ProcessExecutionDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Crea una ejecución de proceso en estado Planificado. */
export async function createProcessExecution(
  input: CreateProcessExecutionRequest,
): Promise<ProcessExecutionDto> {
  const response = await apiClient.post<unknown>('/process-executions', input);
  return processExecutionDtoSchema.parse(response.data);
}
