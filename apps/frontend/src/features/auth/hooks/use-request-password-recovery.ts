import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { ForgotPasswordRequest, ForgotPasswordResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { requestPasswordRecovery } from '../api/request-password-recovery';

/**
 * Hook de mutación para solicitar enlace de recuperación de contraseña (HU-005, RF-005, RS-002).
 * Configurado con `retry: false` para evitar llamadas redundantes y respetar los límites de tasa.
 */
export function useRequestPasswordRecovery(): UseMutationResult<
  ForgotPasswordResponse,
  ApiError,
  ForgotPasswordRequest
> {
  return useMutation<ForgotPasswordResponse, ApiError, ForgotPasswordRequest>({
    mutationFn: requestPasswordRecovery,
    retry: false,
  });
}
