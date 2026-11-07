import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListPermissionsResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { listPermissions } from '../api/list-permissions';
import { authorizationKeys } from './authorization-keys';

export function usePermissions(): UseQueryResult<ListPermissionsResponse, ApiError> {
  return useQuery<ListPermissionsResponse, ApiError>({
    queryKey: authorizationKeys.permissions.all,
    queryFn: () => listPermissions(),
    staleTime: 30 * 60 * 1000,
  });
}
