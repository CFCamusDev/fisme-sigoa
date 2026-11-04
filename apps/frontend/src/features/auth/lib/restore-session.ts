import { ApiError } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth.store';
import { refreshSession } from '../api/refresh';
import { clearSessionHint, hasValidSessionHint, setSessionHint } from './session-hint';

let activeRestorePromise: Promise<boolean> | null = null;

async function executeRestoreSession(): Promise<boolean> {
  if (!hasValidSessionHint()) {
    return false;
  }

  try {
    const result = await refreshSession();
    useAuthStore.getState().setAuthSession(result);
    setSessionHint(result.refreshTokenExpiresAt);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSessionHint();
      useAuthStore.getState().clearAuthSession();
    }
    return false;
  }
}

/**
 * Restaura la sesión en memoria al recargar la aplicación si existe un indicio
 * válido de sesión en el navegador (cookie HttpOnly y fecha futura en localStorage).
 * Deduplica llamadas concurrentes y se coordina entre pestañas con Web Locks.
 *
 * @returns true si la sesión se restauró exitosamente, false en caso contrario.
 */
export async function restoreSession(): Promise<boolean> {
  if (activeRestorePromise) {
    return activeRestorePromise;
  }

  activeRestorePromise = (async () => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        'locks' in navigator &&
        typeof navigator.locks?.request === 'function'
      ) {
        return await navigator.locks.request('sigoa-session-restore', () =>
          executeRestoreSession(),
        );
      }
      return await executeRestoreSession();
    } finally {
      activeRestorePromise = null;
    }
  })();

  return activeRestorePromise;
}
