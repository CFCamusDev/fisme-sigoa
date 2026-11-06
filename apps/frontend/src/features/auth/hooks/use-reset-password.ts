import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { ResetPasswordRequest, ResetPasswordResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { resetPassword } from '../api/reset-password';

/**
 * Hook de mutación para restablecer la contraseña personal (HU-005, RF-005, RS-002).
 * Configurado con `retry: false` para respetar la naturaleza de un solo uso del token
 * y evitar reintentos automáticos tras errores de validación o vencimiento.
 */
export function useResetPassword(): UseMutationResult<
  ResetPasswordResponse,
  ApiError,
  ResetPasswordRequest
> {
  return useMutation<ResetPasswordResponse, ApiError, ResetPasswordRequest>({
    mutationFn: resetPassword,
    retry: false,
  });
}
