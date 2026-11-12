import { ApiError } from '@/lib/api-error';
import type { SessionRefresher } from '@/lib/session-refresh';
import { useAuthStore } from '@/stores/auth.store';
import { refreshSession } from '../api/refresh';

export interface SessionRefresherOptions {
  onSessionExpired: () => void;
}

/**
 * Crea una instancia de SessionRefresher que ejecuta la llamada de refresh,
 * actualiza el store de Zustand en memoria si tiene éxito, o invoca onSessionExpired
 * si el refresh token expiró o fue revocado en el backend (status 401).
 */
export function createSessionRefresher(options: SessionRefresherOptions): SessionRefresher {
  return {
    async refresh(): Promise<boolean> {
      try {
        const renewed = await refreshSession();
        useAuthStore.getState().setAuthSession(renewed);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          options.onSessionExpired();
          return false;
        }

        // Errores transitorios (red, 5xx, 429) se relanzan para no expulsar al usuario
        throw error;
      }
    },
  };
}
