import {
  resetPasswordRequestSchema,
  resetPasswordResponseSchema,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/**
 * Registro de promesas en vuelo indexadas por token de restablecimiento (D7, AGENTS §5).
 * Deduplica llamadas concurrentes para el mismo recurso de un solo uso evitando
 * múltiples peticiones HTTP simultáneas al backend.
 */
const inFlightRequests = new Map<string, Promise<ResetPasswordResponse>>();

export async function resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const validatedRequest = resetPasswordRequestSchema.parse(request);

  const existing = inFlightRequests.get(validatedRequest.token);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const response = await apiClient.post<unknown>('/auth/reset-password', validatedRequest);
      return resetPasswordResponseSchema.parse(response.data);
    } finally {
      inFlightRequests.delete(validatedRequest.token);
    }
  })();

  inFlightRequests.set(validatedRequest.token, promise);
  return promise;
}
