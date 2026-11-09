import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ProgramDto } from '@sigoa/shared';
import { ApiError } from '@/lib/api-error';
import { getProgram } from '../api/get-program';
import { programKeys } from './program-keys';

export function useProgram(): UseQueryResult<ProgramDto, ApiError> {
  return useQuery<ProgramDto, ApiError>({
    queryKey: programKeys.all,
    queryFn: getProgram,
    staleTime: 30_000,
    retry: (_failureCount, error) => {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        return false;
      }
      return false;
    },
  });
}
