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

/** Mensaje al usuario para los errores de importación de constituyentes desde Excel (HU-023). */
export function getStakeholderImportErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const errObj = error as { name?: unknown };
  if (errObj.name === 'NotReadableError') {
    return 'No se pudo leer el archivo; selecciónalo de nuevo.';
  }

  const apiErr = error as Partial<ApiError>;
  const message = serverMessage(apiErr);

  switch (apiErr.status) {
    case 400:
      return message && message !== GENERIC_VALIDATION
        ? message
        : 'El archivo no cumple el formato esperado o no contiene filas válidas para importar.';
    case 403:
      return 'No tienes permiso para importar constituyentes.';
    case 404:
      return 'La lista de constituyentes ya no existe. Recarga la página.';
    case 409:
      return message ?? 'Conflicto al importar los constituyentes. Intenta nuevamente.';
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_DOWN;
  }

  return GENERIC;
}
