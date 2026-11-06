import type { ApiError } from '@/lib/api-error';

/**
 * Traduce errores de la API de recuperación de contraseña a mensajes legibles en español (HU-005, RNF-037).
 */
export function getPasswordRecoveryErrorMessage(error: unknown): string {
  const apiError = error as Partial<ApiError> | undefined;
  const code = apiError?.code;

  switch (code) {
    case 'RATE_LIMITED':
      return 'Hiciste demasiados intentos. Espera un minuto e inténtalo de nuevo.';

    case 'NETWORK_ERROR':
    default:
      return 'No pudimos procesar tu solicitud. Inténtalo de nuevo; si persiste, avisa al administrador.';
  }
}
