import { scheduleResponseSchema, type ScheduleResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Consulta las actividades del cronograma (Anexo 1) de una ejecución. */
export async function getSchedule(executionId: string): Promise<ScheduleResponse> {
  const response = await apiClient.get<unknown>(`/process-executions/${executionId}/schedule`);
  return scheduleResponseSchema.parse(response.data);
}
