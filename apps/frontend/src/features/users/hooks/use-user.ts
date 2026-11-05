import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { UserDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getUser } from '../api/get-user';
import { usersKeys } from './users-keys';

export function useUser(id?: string): UseQueryResult<UserDto, ApiError> {
  return useQuery<UserDto, ApiError>({
    queryKey: usersKeys.detail(id ?? ''),
    queryFn: () => getUser(id!),
    enabled: Boolean(id),
  });
}
