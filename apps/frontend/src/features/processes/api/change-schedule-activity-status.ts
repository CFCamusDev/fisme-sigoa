import {
  scheduleActivityDtoSchema,
  type ChangeScheduleActivityStatusRequest,
  type ScheduleActivityDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Cambia el estado de una actividad del cronograma (IN_PROGRESS o COMPLETED). */
export async function changeScheduleActivityStatus(
  activityId: string,
  body: ChangeScheduleActivityStatusRequest,
): Promise<ScheduleActivityDto> {
  const response = await apiClient.patch<unknown>(
    `/schedule-activities/${activityId}/status`,
    body,
  );
  return scheduleActivityDtoSchema.parse(response.data);
}
