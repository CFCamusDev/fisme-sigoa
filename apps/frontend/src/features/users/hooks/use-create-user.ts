import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CreateUserRequest, UserDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { createUser } from '../api/create-user';
import { usersKeys } from './users-keys';

export function useCreateUser(): UseMutationResult<UserDto, ApiError, CreateUserRequest> {
  const queryClient = useQueryClient();

  return useMutation<UserDto, ApiError, CreateUserRequest>({
    mutationFn: createUser,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}
