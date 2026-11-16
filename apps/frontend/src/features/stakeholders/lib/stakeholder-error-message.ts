import type { ApiError } from '@/lib/api-error';

const GENERIC = 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
const SERVER_DOWN =
  'No se pudo completar la operación por un problema del servidor. Intenta de nuevo en unos minutos.';
const GENERIC_VALIDATION = 'La solicitud contiene errores de validación';

function serverMessage(error: Partial<ApiError>): string | null {
  return typeof error.message === 'string' && error.message.trim().length > 0
    ? error.message
    : null;
}

/** Mensaje al usuario para los errores del registro maestro de constituyentes (HU-021). */
export function getStakeholderErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  const message = serverMessage(apiErr);

  switch (apiErr.status) {
    case 400:
      return message && message !== GENERIC_VALIDATION
        ? message
        : 'Revisa los datos ingresados del constituyente.';
    case 403:
      return 'No tienes permiso para realizar esta acción sobre constituyentes.';
    case 404:
      return 'El constituyente solicitado ya no existe. Recarga la página para ver el estado actual.';
    case 409:
      return message ?? 'El constituyente cambió o ya existe otro registro con el mismo documento.';
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_DOWN;
  }

  return GENERIC;
}
