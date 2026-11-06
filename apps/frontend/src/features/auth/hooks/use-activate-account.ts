import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { ActivateAccountRequest, ActivateAccountResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { activateAccount } from '../api/activate-account';

/**
 * Hook de mutación para activar cuenta institucional (HU-004, RF-004, RS-007).
 * Configurado con `retry: false` para respetar la naturaleza de un solo uso del token
 * y evitar reintentos automáticos tras errores de validación o vencimiento.
 */
export function useActivateAccount(): UseMutationResult<
  ActivateAccountResponse,
  ApiError,
  ActivateAccountRequest
> {
  return useMutation<ActivateAccountResponse, ApiError, ActivateAccountRequest>({
    mutationFn: activateAccount,
    retry: false,
  });
}
