import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { RoleDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { changeRoleStatus, type ChangeRoleStatusParams } from '../api/change-role-status';
import { authorizationKeys } from './authorization-keys';

export function useChangeRoleStatus(): UseMutationResult<
  RoleDto,
  ApiError,
  ChangeRoleStatusParams
> {
  const queryClient = useQueryClient();

  return useMutation<RoleDto, ApiError, ChangeRoleStatusParams>({
    mutationFn: changeRoleStatus,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authorizationKeys.roles.all });
    },
  });
}
