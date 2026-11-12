import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CreateRoleRequest, RoleDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { createRole } from '../api/create-role';
import { authorizationKeys } from './authorization-keys';

export function useCreateRole(): UseMutationResult<RoleDto, ApiError, CreateRoleRequest> {
  const queryClient = useQueryClient();

  return useMutation<RoleDto, ApiError, CreateRoleRequest>({
    mutationFn: createRole,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authorizationKeys.roles.all });
    },
  });
}
