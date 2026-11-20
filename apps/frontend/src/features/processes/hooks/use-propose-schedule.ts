import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ScheduleResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { proposeSchedule } from '../api/propose-schedule';
import { scheduleKeys } from './schedule-keys';

export function useProposeSchedule(
  executionId: string,
): UseMutationResult<ScheduleResponse, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation<ScheduleResponse, ApiError, void>({
    mutationFn: () =>
      shareInFlight(`propose-schedule:${executionId}`, () => proposeSchedule(executionId)),
    retry: false,
    onSuccess: (data) => {
      queryClient.setQueryData(scheduleKeys.detail(executionId), data);
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(executionId) });
      }
    },
  });
}
