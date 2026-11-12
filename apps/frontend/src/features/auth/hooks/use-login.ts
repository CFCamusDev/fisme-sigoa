import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { LoginRequest, LoginResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { login } from '../api/login';

export function useLogin(): UseMutationResult<LoginResponse, ApiError, LoginRequest> {
  return useMutation<LoginResponse, ApiError, LoginRequest>({
    mutationFn: login,
    retry: false,
  });
}
