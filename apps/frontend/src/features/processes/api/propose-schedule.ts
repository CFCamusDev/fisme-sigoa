import { scheduleResponseSchema, type ScheduleResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Propone las actividades oficiales del procedimiento para una ejecución sin cronograma. */
export async function proposeSchedule(executionId: string): Promise<ScheduleResponse> {
  const response = await apiClient.post<unknown>(
    `/process-executions/${executionId}/schedule/propose`,
    {},
  );
  return scheduleResponseSchema.parse(response.data);
}
