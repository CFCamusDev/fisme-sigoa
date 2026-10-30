import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { apiErrorResponseSchema } from '@sigoa/shared';
import { ApiError } from './api-error';
import { env } from './env';

type AuthTokenProvider = () => string | null | undefined;

let authTokenProvider: AuthTokenProvider | null = null;

export function setAuthTokenProvider(provider: AuthTokenProvider | null): void {
  authTokenProvider = provider;
}

export function getAuthTokenProvider(): AuthTokenProvider | null {
  return authTokenProvider;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.VITE_API_URL,
  timeout: 15000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Asegura cabecera X-Request-Id (formato UUID v4)
  if (!config.headers['X-Request-Id']) {
    config.headers['X-Request-Id'] = crypto.randomUUID();
  }

  // Inyección de token de autorización si hay un proveedor registrado
  if (authTokenProvider && !config.headers.Authorization) {
    const token = authTokenProvider();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Caso A: El servidor respondió con un status fuera del rango 2xx
    if (error.response) {
      const status = error.response.status;
      const parsedBackendError = apiErrorResponseSchema.safeParse(error.response.data);

      if (parsedBackendError.success) {
        const { code, message, details, requestId, retryAfterSeconds } =
          parsedBackendError.data.error;
        return Promise.reject(
          new ApiError({
            code,
            message,
            status,
            details,
            requestId,
            retryAfterSeconds,
          }),
        );
      }

      const defaultMessage = getHttpStatusMessage(status);
      return Promise.reject(
        new ApiError({
          code: `HTTP_${status}`,
          message: defaultMessage,
          status,
        }),
      );
    }

    // Caso B: Solicitud realizada pero no se recibió respuesta (red o timeout)
    if (error.request) {
      return Promise.reject(
        new ApiError({
          code: 'NETWORK_ERROR',
          message:
            'No se pudo conectar con el servidor. Verifica tu conexión de red o contacta con soporte si el problema persiste.',
        }),
      );
    }

    // Caso C: Error durante la configuración de la petición
    return Promise.reject(
      new ApiError({
        code: 'REQUEST_SETUP_ERROR',
        message: error.message || 'Error inesperado al preparar la solicitud.',
      }),
    );
  },
);

function getHttpStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'La solicitud contiene parámetros no válidos.';
    case 401:
      return 'No autenticado. Por favor inicia sesión nuevamente.';
    case 403:
      return 'No cuentas con los permisos necesarios para realizar esta acción.';
    case 404:
      return 'El recurso solicitado no fue encontrado.';
    case 409:
      return 'Conflicto al procesar la solicitud con el estado actual del recurso.';
    case 429:
      return 'Demasiadas solicitudes. Por favor espera unos momentos antes de reintentar.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Error interno del servidor. Por favor intenta más tarde.';
    default:
      return `Error del servidor (código ${status}).`;
  }
}
