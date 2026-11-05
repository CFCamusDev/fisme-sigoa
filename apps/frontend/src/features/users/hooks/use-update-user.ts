import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { UpdateUserRequest, UserDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { updateUser } from '../api/update-user';
import { usersKeys } from './users-keys';

export function useUpdateUser(id: string): UseMutationResult<UserDto, ApiError, UpdateUserRequest> {
  const queryClient = useQueryClient();

  return useMutation<UserDto, ApiError, UpdateUserRequest>({
    mutationFn: (body) => updateUser(id, body),
    retry: false,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(usersKeys.detail(id), updatedUser);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}
