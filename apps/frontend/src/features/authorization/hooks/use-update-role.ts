import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { RoleDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { updateRole, type UpdateRoleParams } from '../api/update-role';
import { authorizationKeys } from './authorization-keys';

export function useUpdateRole(): UseMutationResult<RoleDto, ApiError, UpdateRoleParams> {
  const queryClient = useQueryClient();

  return useMutation<RoleDto, ApiError, UpdateRoleParams>({
    mutationFn: updateRole,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authorizationKeys.roles.all });
    },
  });
}
