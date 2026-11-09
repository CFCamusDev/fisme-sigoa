import { clearSessionHint, createSessionRefresher, setSessionHint } from './features/auth';
import { queryClient } from './lib/query-client';
import { setSessionRefresher } from './lib/session-refresh';
import { useAuthStore } from './stores/auth.store';

export type SessionExpiredReason = 'session-expired';

export interface ConfigureSessionOptions {
  navigateToLogin: (reason?: SessionExpiredReason) => void;
  queryClientOverride?: typeof queryClient;
}

/**
 * Configura la orquestación global de sesión:
 * - Registra el SessionRefresher en Axios para renovar transparentemente en 401.
 * - Ante sesión expirada (401 de refresh), limpia tokens en memoria, vacía React Query y redirige con aviso.
 */
export function configureSession(options: ConfigureSessionOptions): void {
  const activeQueryClient = options.queryClientOverride ?? queryClient;

  const refresher = createSessionRefresher({
    onSessionExpired: () => {
      useAuthStore.getState().clearAuthSession();
      activeQueryClient.clear();
      options.navigateToLogin('session-expired');
    },
  });

  setSessionRefresher(refresher);

  useAuthStore.subscribe((state, prevState) => {
    if (state.refreshTokenExpiresAt) {
      setSessionHint(state.refreshTokenExpiresAt);
    } else {
      clearSessionHint();
      if (prevState.user) {
        activeQueryClient.removeQueries({ queryKey: ['me', 'permissions'] });
      }
    }
  });
}
