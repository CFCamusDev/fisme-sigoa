import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListSemestersResponse } from '@sigoa/shared';
import { ApiError } from '@/lib/api-error';
import { getSemesters } from '../api/get-semesters';
import { semesterKeys } from './semester-keys';

export function useSemesters(): UseQueryResult<ListSemestersResponse, ApiError> {
  return useQuery<ListSemestersResponse, ApiError>({
    queryKey: semesterKeys.all,
    queryFn: getSemesters,
    staleTime: 30_000,
    retry: (_failureCount, error) => {
      if (error instanceof ApiError && error.status === 403) {
        return false;
      }
      return false;
    },
  });
}
