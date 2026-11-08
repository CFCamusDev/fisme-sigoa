import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { UserAccessDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getUserAccess } from '../api/get-user-access';
import { authorizationKeys } from './authorization-keys';

export function useUserAccess(userId: string): UseQueryResult<UserAccessDto, ApiError> {
  return useQuery<UserAccessDto, ApiError>({
    queryKey: authorizationKeys.userAccess.detail(userId),
    queryFn: () => getUserAccess(userId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    enabled: Boolean(userId),
  });
}
