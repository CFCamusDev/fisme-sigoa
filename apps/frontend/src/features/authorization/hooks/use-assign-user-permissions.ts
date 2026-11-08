import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { AssignUserPermissionsRequest, UserAccessDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { assignUserPermissions } from '../api/assign-user-permissions';
import { authorizationKeys } from './authorization-keys';

export function useAssignUserPermissions(
  userId: string,
): UseMutationResult<UserAccessDto, ApiError, AssignUserPermissionsRequest> {
  const queryClient = useQueryClient();

  return useMutation<UserAccessDto, ApiError, AssignUserPermissionsRequest>({
    mutationFn: (body: AssignUserPermissionsRequest) => assignUserPermissions({ userId, body }),
    retry: false,
    onSuccess: (data) => {
      queryClient.setQueryData(authorizationKeys.userAccess.detail(userId), data);
    },
  });
}
