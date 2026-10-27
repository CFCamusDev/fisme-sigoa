import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error';
import { createQueryClient, shouldRetryQuery } from './query-client';

describe('queryClient configuration', () => {
  it('creates query client with configured default options', () => {
    const client = createQueryClient();
    const defaultOptions = client.getDefaultOptions();

    expect(defaultOptions.queries?.staleTime).toBe(30000);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
  });

  describe('shouldRetryQuery', () => {
    it('stops retrying when failureCount reaches 2', () => {
      const error = new ApiError({
        code: 'NETWORK_ERROR',
        message: 'Conexión perdida',
      });

      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(true);
      expect(shouldRetryQuery(2, error)).toBe(false);
    });

    it('does not retry 4xx client errors', () => {
      const notFoundError = new ApiError({
        code: 'NOT_FOUND',
        message: 'No encontrado',
        status: 404,
      });

      const badRequestError = new ApiError({
        code: 'VALIDATION_ERROR',
        message: 'Datos no válidos',
        status: 400,
      });

      expect(shouldRetryQuery(0, notFoundError)).toBe(false);
      expect(shouldRetryQuery(0, badRequestError)).toBe(false);
    });

    it('retries 5xx server errors and network errors', () => {
      const serverError = new ApiError({
        code: 'INTERNAL_ERROR',
        message: 'Error en el servidor',
        status: 500,
      });

      const networkError = new ApiError({
        code: 'NETWORK_ERROR',
        message: 'Error de red',
      });

      expect(shouldRetryQuery(0, serverError)).toBe(true);
      expect(shouldRetryQuery(0, networkError)).toBe(true);
    });

    it('does not retry unexpected non-ApiError errors', () => {
      expect(shouldRetryQuery(0, new Error('Error genérico'))).toBe(false);
    });
  });
});
