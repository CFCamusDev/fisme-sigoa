import {
  scheduleResponseSchema,
  type SaveScheduleRequest,
  type ScheduleResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Reemplaza el cronograma completo de una ejecución. */
export async function saveSchedule(
  executionId: string,
  body: SaveScheduleRequest,
): Promise<ScheduleResponse> {
  const response = await apiClient.put<unknown>(
    `/process-executions/${executionId}/schedule`,
    body,
  );
  return scheduleResponseSchema.parse(response.data);
}
