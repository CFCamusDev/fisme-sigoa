import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-error';

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) {
    return false;
  }

  if (error instanceof ApiError) {
    // Errores 4xx (solicitud incorrecta, no autorizado, etc.) no deben reintentarse
    if (error.status && error.status >= 400 && error.status < 500) {
      return false;
    }
    // Errores de red o 5xx se reintentan hasta 2 veces
    return true;
  }

  return false;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
    },
  });
}

export const queryClient = createQueryClient();
