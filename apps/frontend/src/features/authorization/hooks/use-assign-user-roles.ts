import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { AssignUserRolesRequest, UserAccessDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { assignUserRoles } from '../api/assign-user-roles';
import { authorizationKeys } from './authorization-keys';

export function useAssignUserRoles(
  userId: string,
): UseMutationResult<UserAccessDto, ApiError, AssignUserRolesRequest> {
  const queryClient = useQueryClient();

  return useMutation<UserAccessDto, ApiError, AssignUserRolesRequest>({
    mutationFn: (body: AssignUserRolesRequest) => assignUserRoles({ userId, body }),
    retry: false,
    onSuccess: (data) => {
      queryClient.setQueryData(authorizationKeys.userAccess.detail(userId), data);
      queryClient.invalidateQueries({ queryKey: authorizationKeys.roles.all });
    },
  });
}
