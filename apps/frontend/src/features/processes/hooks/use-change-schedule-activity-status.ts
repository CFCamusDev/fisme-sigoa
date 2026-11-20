import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type {
  ChangeScheduleActivityStatusRequest,
  ScheduleActivityDto,
  ScheduleResponse,
} from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { changeScheduleActivityStatus } from '../api/change-schedule-activity-status';
import { scheduleKeys } from './schedule-keys';

export interface ChangeScheduleActivityStatusVariables {
  readonly activityId: string;
  readonly body: ChangeScheduleActivityStatusRequest;
}

export function useChangeScheduleActivityStatus(
  executionId: string,
): UseMutationResult<ScheduleActivityDto, ApiError, ChangeScheduleActivityStatusVariables> {
  const queryClient = useQueryClient();

  return useMutation<ScheduleActivityDto, ApiError, ChangeScheduleActivityStatusVariables>({
    mutationFn: ({ activityId, body }) =>
      shareInFlight(
        `change-schedule-status:${activityId}:${body.status}:${body.actualEndDate ?? ''}`,
        () => changeScheduleActivityStatus(activityId, body),
      ),
    retry: false,
    onSuccess: (updated) => {
      queryClient.setQueryData<ScheduleResponse>(scheduleKeys.detail(executionId), (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          items: prev.items.map((item) => (item.id === updated.id ? updated : item)),
        };
      });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(executionId) });
      }
    },
  });
}
