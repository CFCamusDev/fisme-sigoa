import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export interface SessionRefresher {
  refresh(): Promise<boolean>;
}

let sessionRefresher: SessionRefresher | null = null;
let activeRefreshPromise: Promise<boolean> | null = null;

export function setSessionRefresher(refresher: SessionRefresher | null): void {
  sessionRefresher = refresher;
}

export function getSessionRefresher(): SessionRefresher | null {
  return sessionRefresher;
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _isRetry?: boolean;
}

/**
 * Determina si la URL es elegible para renovación automática al recibir 401.
 * No son elegibles /auth/login ni /auth/refresh para evitar bucles.
 * /auth/logout sí es elegible.
 */
function isUrlEligibleForRefresh(url?: string): boolean {
  if (!url) return false;
  const cleanUrl = url.split('?')[0] ?? '';
  return !cleanUrl.endsWith('/auth/login') && !cleanUrl.endsWith('/auth/refresh');
}

async function runRefreshWithLock(refresher: SessionRefresher): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    typeof navigator.locks?.request === 'function'
  ) {
    return navigator.locks.request('sigoa-session-refresh', () => refresher.refresh());
  }
  return refresher.refresh();
}

/**
 * Intercepta errores 401, renueva la sesión mediante el refresher configurado
 * y reintenta la petición original con el nuevo token.
 * Devuelve null si el error no es elegible para renovación (permitiendo que el manejador estándar lo procese).
 */
export function tryRefreshAndRetry(
  error: AxiosError,
  client: AxiosInstance,
): Promise<AxiosResponse> | null {
  if (!sessionRefresher) {
    return null;
  }

  if (error.response?.status !== 401) {
    return null;
  }

  const config = error.config as RetryableRequestConfig | undefined;
  if (!config) {
    return null;
  }

  if (config._isRetry) {
    return null;
  }

  if (!isUrlEligibleForRefresh(config.url)) {
    return null;
  }

  config._isRetry = true;

  if (!activeRefreshPromise) {
    activeRefreshPromise = runRefreshWithLock(sessionRefresher).finally(() => {
      activeRefreshPromise = null;
    });
  }

  return activeRefreshPromise.then(
    (refreshed) => {
      if (!refreshed) {
        return Promise.reject(error);
      }

      // Quitar token vencido para que el request interceptor de axios inyecte el nuevo
      if (config.headers) {
        delete config.headers.Authorization;
      }

      return client.request(config);
    },
    (refreshError) => {
      // Propagar fallos transitorios (red, 5xx) sin cerrar la sesión
      return Promise.reject(refreshError);
    },
  );
}
