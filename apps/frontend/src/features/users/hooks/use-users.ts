import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListUsersResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { listUsers, type ListUsersQueryInput } from '../api/list-users';
import { usersKeys } from './users-keys';

export function useUsers(query?: ListUsersQueryInput): UseQueryResult<ListUsersResponse, ApiError> {
  return useQuery<ListUsersResponse, ApiError>({
    queryKey: usersKeys.list(query),
    queryFn: () => listUsers(query),
    placeholderData: keepPreviousData,
  });
}
