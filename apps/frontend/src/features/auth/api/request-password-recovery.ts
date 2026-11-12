import {
  forgotPasswordRequestSchema,
  forgotPasswordResponseSchema,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/**
 * Registro de promesas en vuelo indexadas por correo institucional normalizado (D7, AGENTS §5).
 * Deduplica llamadas concurrentes para el mismo correo evitando múltiples peticiones
 * HTTP simultáneas al backend.
 */
const inFlightRequests = new Map<string, Promise<ForgotPasswordResponse>>();

export async function requestPasswordRecovery(
  request: ForgotPasswordRequest,
): Promise<ForgotPasswordResponse> {
  const validatedRequest = forgotPasswordRequestSchema.parse(request);
  const normalizedKey = validatedRequest.email.trim().toLowerCase();

  const existing = inFlightRequests.get(normalizedKey);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const response = await apiClient.post<unknown>('/auth/forgot-password', validatedRequest);
      return forgotPasswordResponseSchema.parse(response.data);
    } finally {
      inFlightRequests.delete(normalizedKey);
    }
  })();

  inFlightRequests.set(normalizedKey, promise);
  return promise;
}
