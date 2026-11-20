import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ScheduleResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getSchedule } from '../api/get-schedule';
import { scheduleKeys } from './schedule-keys';

export function useSchedule(executionId: string): UseQueryResult<ScheduleResponse, ApiError> {
  return useQuery<ScheduleResponse, ApiError>({
    queryKey: scheduleKeys.detail(executionId),
    queryFn: () => getSchedule(executionId),
    enabled: executionId.trim().length > 0,
  });
}
