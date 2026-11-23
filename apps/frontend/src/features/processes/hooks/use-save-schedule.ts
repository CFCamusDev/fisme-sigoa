import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { SaveScheduleRequest, ScheduleResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { saveSchedule } from '../api/save-schedule';
import { processExecutionKeys } from './process-execution-keys';
import { scheduleKeys } from './schedule-keys';

export function useSaveSchedule(
  executionId: string,
): UseMutationResult<ScheduleResponse, ApiError, SaveScheduleRequest> {
  const queryClient = useQueryClient();

  return useMutation<ScheduleResponse, ApiError, SaveScheduleRequest>({
    mutationFn: (body) =>
      shareInFlight(`save-schedule:${executionId}:${JSON.stringify(body)}`, () =>
        saveSchedule(executionId, body),
      ),
    retry: false,
    onSuccess: (data) => {
      queryClient.setQueryData(scheduleKeys.detail(executionId), data);
      void queryClient.invalidateQueries({
        queryKey: processExecutionKeys.nextTransition(executionId),
      });
      void queryClient.invalidateQueries({
        queryKey: processExecutionKeys.board(executionId),
      });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(executionId) });
      }
    },
  });
}
