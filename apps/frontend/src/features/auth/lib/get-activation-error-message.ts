import type { ApiError } from '@/lib/api-error';

/**
 * Traduce errores de la API de activación a mensajes legibles en español (HU-004, RNF-037).
 * Nota: INVALID_ACTIVATION_TOKEN es manejado como un estado completo de pantalla en ActivationPage
 * y no pasa por este formateador de errores de alerta recuperables.
 */
export function getActivationErrorMessage(error: unknown): string {
  const apiError = error as Partial<ApiError> | undefined;
  const code = apiError?.code;

  switch (code) {
    case 'RATE_LIMITED':
      return 'Hiciste demasiados intentos. Espera un minuto e inténtalo de nuevo.';

    case 'NETWORK_ERROR':
    default:
      return 'No pudimos activar tu cuenta. Inténtalo de nuevo; si persiste, avisa al administrador.';
  }
}
