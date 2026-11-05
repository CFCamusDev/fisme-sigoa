import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ChangeUserStatusRequest, UserDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { changeUserStatus } from '../api/change-user-status';
import { usersKeys } from './users-keys';

export function useChangeUserStatus(): UseMutationResult<
  UserDto,
  ApiError,
  { id: string; body: ChangeUserStatusRequest }
> {
  const queryClient = useQueryClient();

  return useMutation<UserDto, ApiError, { id: string; body: ChangeUserStatusRequest }>({
    mutationFn: ({ id, body }) => changeUserStatus(id, body),
    retry: false,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(usersKeys.detail(updatedUser.id), updatedUser);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}
