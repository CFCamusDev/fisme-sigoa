import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListRolesResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { listRoles } from '../api/list-roles';
import { rolesKeys } from './users-keys';

export function useRoles(): UseQueryResult<ListRolesResponse, ApiError> {
  return useQuery<ListRolesResponse, ApiError>({
    queryKey: rolesKeys.all,
    queryFn: () => listRoles(),
    staleTime: 5 * 60 * 1000,
  });
}
