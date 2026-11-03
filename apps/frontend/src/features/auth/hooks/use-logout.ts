import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ApiError } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth.store';
import { logout } from '../api/logout';

/**
 * Hook para cerrar sesión en el sistema (HU-002, CA2).
 * Invoca el endpoint de revocación en el backend y siempre (éxito o error)
 * limpia los tokens en memoria, vacía la caché de consultas y redirige al login.
 */
export function useLogout(): UseMutationResult<void, ApiError, void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const clearAuthSession = useAuthStore((state) => state.clearAuthSession);

  return useMutation<void, ApiError, void>({
    mutationFn: logout,
    retry: false,
    onSettled: async () => {
      clearAuthSession();
      queryClient.clear();
      await navigate({ to: '/login', replace: true });
    },
  });
}
