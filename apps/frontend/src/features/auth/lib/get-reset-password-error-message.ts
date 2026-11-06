import { ApiError } from '@/lib/api-error';

export function getResetPasswordErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
    return 'Hiciste demasiados intentos. Espera un minuto e inténtalo de nuevo.';
  }

  return 'No pudimos restablecer tu contraseña. Inténtalo de nuevo; si persiste, avisa al administrador.';
}
