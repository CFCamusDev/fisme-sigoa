import type { ApiError } from '@/lib/api-error';
import { readableApiMessage } from '@/lib/validation-errors';

const GENERIC = 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
const SERVER_DOWN =
  'No se pudo completar la operación por un problema del servidor. Intenta de nuevo en unos minutos.';
const GENERIC_VALIDATION = 'La solicitud contiene errores de validación';

function serverMessage(error: Partial<ApiError>): string | null {
  const candidate = readableApiMessage(error, '');
  return candidate.length > 0 ? candidate : null;
}

/** Mensaje en español para errores HTTP del cronograma de ejecuciones (HU-028). */
export function getScheduleErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  const message = serverMessage(apiErr);

  switch (apiErr.status) {
    case 400:
      return message && message !== GENERIC_VALIDATION
        ? message
        : 'Revisa los datos ingresados en el cronograma.';
    case 403:
      return 'No tienes permiso para editar el cronograma.';
    case 404:
      return message ?? 'La ejecución o actividad solicitada ya no existe.';
    case 409:
      return message ?? 'La operación no es válida para el estado actual del cronograma.';
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_DOWN;
  }

  return GENERIC;
}
