import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { RoleDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import {
  updateRolePermissions,
  type UpdateRolePermissionsParams,
} from '../api/update-role-permissions';
import { authorizationKeys } from './authorization-keys';

export function useUpdateRolePermissions(): UseMutationResult<
  RoleDto,
  ApiError,
  UpdateRolePermissionsParams
> {
  const queryClient = useQueryClient();

  return useMutation<RoleDto, ApiError, UpdateRolePermissionsParams>({
    mutationFn: updateRolePermissions,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authorizationKeys.roles.all });
    },
  });
}
