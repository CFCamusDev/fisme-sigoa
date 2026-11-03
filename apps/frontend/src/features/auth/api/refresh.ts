import { refreshResponseSchema, type RefreshResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/**
 * Solicita la rotación de sesión al backend.
 * El refresh token viaja de forma transparente en la cookie HttpOnly sigoa_refresh_token.
 */
export async function refreshSession(): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>('/auth/refresh');
  return refreshResponseSchema.parse(response.data);
}
