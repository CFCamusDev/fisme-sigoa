import { beforeEach, describe, expect, it } from 'vitest';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from './api-error';
import { apiClient, setAuthTokenProvider } from './axios';

function getRequestInterceptor() {
  const handler = (
    apiClient.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
      }>;
    }
  ).handlers[0]?.fulfilled;
  if (!handler) {
    throw new Error('Request interceptor handler no encontrado');
  }
  return handler;
}

function getResponseErrorHandler() {
  const handler = (
    apiClient.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<never> }>;
    }
  ).handlers[0]?.rejected;
  if (!handler) {
    throw new Error('Response error handler no encontrado');
  }
  return handler;
}

describe('apiClient interceptors', () => {
  beforeEach(() => {
    setAuthTokenProvider(null);
  });

  describe('request interceptor', () => {
    it('injects X-Request-Id header when not present', async () => {
      const config: InternalAxiosRequestConfig = {
        headers: {} as InternalAxiosRequestConfig['headers'],
      };

      const handler = getRequestInterceptor();
      const updatedConfig = await handler(config);

      expect(updatedConfig.headers['X-Request-Id']).toBeDefined();
      expect(typeof updatedConfig.headers['X-Request-Id']).toBe('string');
      // Debe ser un UUID v4 válido
      expect(updatedConfig.headers['X-Request-Id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('preserves existing X-Request-Id header if already set', async () => {
      const customId = '11111111-2222-3333-4444-555555555555';
      const config: InternalAxiosRequestConfig = {
        headers: {
          'X-Request-Id': customId,
        } as unknown as InternalAxiosRequestConfig['headers'],
      };

      const handler = getRequestInterceptor();
      const updatedConfig = await handler(config);
      expect(updatedConfig.headers['X-Request-Id']).toBe(customId);
    });

    it('injects Authorization header when authTokenProvider provides a token', async () => {
      setAuthTokenProvider(() => 'mock-jwt-token-xyz');

      const config: InternalAxiosRequestConfig = {
        headers: {} as InternalAxiosRequestConfig['headers'],
      };

      const handler = getRequestInterceptor();
      const updatedConfig = await handler(config);
      expect(updatedConfig.headers.Authorization).toBe('Bearer mock-jwt-token-xyz');
    });

    it('does not inject Authorization header when authTokenProvider returns null', async () => {
      setAuthTokenProvider(() => null);

      const config: InternalAxiosRequestConfig = {
        headers: {} as InternalAxiosRequestConfig['headers'],
      };

      const handler = getRequestInterceptor();
      const updatedConfig = await handler(config);
      expect(updatedConfig.headers.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor', () => {
    it('transforms structured backend error response into ApiError', async () => {
      const backendError: AxiosError = {
        name: 'AxiosError',
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Los datos enviados contienen errores de validación.',
              details: [{ path: 'name', message: 'El nombre es obligatorio' }],
              requestId: 'req-12345',
            },
          },
        } as AxiosResponse,
        isAxiosError: true,
        toJSON: () => ({}),
      };

      const errorHandler = getResponseErrorHandler();
      await expect(errorHandler(backendError)).rejects.toThrow(ApiError);

      try {
        await errorHandler(backendError);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('VALIDATION_ERROR');
        expect(apiErr.message).toBe('Los datos enviados contienen errores de validación.');
        expect(apiErr.status).toBe(400);
        expect(apiErr.requestId).toBe('req-12345');
        expect(apiErr.details).toEqual([{ path: 'name', message: 'El nombre es obligatorio' }]);
      }
    });

    it('propagates retryAfterSeconds from structured backend error response', async () => {
      const backendLockoutError: AxiosError = {
        name: 'AxiosError',
        message: 'Request failed with status code 429',
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          data: {
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Cuenta bloqueada temporalmente.',
              retryAfterSeconds: 900,
              requestId: 'req-lock-456',
            },
          },
        } as AxiosResponse,
        isAxiosError: true,
        toJSON: () => ({}),
      };

      const errorHandler = getResponseErrorHandler();
      try {
        await errorHandler(backendLockoutError);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('ACCOUNT_LOCKED');
        expect(apiErr.status).toBe(429);
        expect(apiErr.retryAfterSeconds).toBe(900);
        expect(apiErr.requestId).toBe('req-lock-456');
      }
    });

    it('transforms unstructured HTTP error into ApiError with Spanish message', async () => {
      const httpError: AxiosError = {
        name: 'AxiosError',
        message: 'Request failed with status code 403',
        response: {
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          data: '<html>Forbidden</html>',
        } as AxiosResponse,
        isAxiosError: true,
        toJSON: () => ({}),
      };

      const errorHandler = getResponseErrorHandler();
      try {
        await errorHandler(httpError);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('HTTP_403');
        expect(apiErr.status).toBe(403);
        expect(apiErr.message).toContain('No cuentas con los permisos necesarios');
      }
    });

    it('transforms network error into ApiError with NETWORK_ERROR code', async () => {
      const networkError: AxiosError = {
        name: 'AxiosError',
        message: 'Network Error',
        request: {},
        isAxiosError: true,
        toJSON: () => ({}),
      };

      const errorHandler = getResponseErrorHandler();
      try {
        await errorHandler(networkError);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('NETWORK_ERROR');
        expect(apiErr.message).toContain('No se pudo conectar con el servidor');
      }
    });
  });
});
