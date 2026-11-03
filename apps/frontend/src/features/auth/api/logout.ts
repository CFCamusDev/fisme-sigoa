import { apiClient } from '@/lib/axios';

/**
 * Solicita el cierre de sesión revocando el token en el backend y limpiando la cookie HttpOnly.
 */
export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}
