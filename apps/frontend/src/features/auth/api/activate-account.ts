import {
  activateAccountRequestSchema,
  activateAccountResponseSchema,
  type ActivateAccountRequest,
  type ActivateAccountResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/**
 * Registro de promesas en vuelo indexadas por token de activación (D8, AGENTS §5).
 * Deduplica llamadas concurrentes para el mismo recurso de un solo uso evitando
 * múltiples peticiones HTTP simultáneas al backend.
 */
const inFlightRequests = new Map<string, Promise<ActivateAccountResponse>>();

export async function activateAccount(
  request: ActivateAccountRequest,
): Promise<ActivateAccountResponse> {
  const validatedRequest = activateAccountRequestSchema.parse(request);

  const existing = inFlightRequests.get(validatedRequest.token);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const response = await apiClient.post<unknown>('/auth/activate', validatedRequest);
      return activateAccountResponseSchema.parse(response.data);
    } finally {
      inFlightRequests.delete(validatedRequest.token);
    }
  })();

  inFlightRequests.set(validatedRequest.token, promise);
  return promise;
}
