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

/** Mensaje al usuario para los errores de listar, registrar y aprobar resoluciones (HU-048). */
export function getResolutionErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  const message = serverMessage(apiErr);
  switch (apiErr.status) {
    case 400:
      // El servidor explica qué falta (PDF obligatorio, tamaño, número o fecha inválidos).
      return message && message !== GENERIC_VALIDATION
        ? message
        : 'Revisa los datos ingresados: el número, la fecha y la versión deben ser válidos.';
    case 403:
      return 'No tienes permiso para esta operación de resoluciones.';
    case 404:
      return 'La resolución o la versión del catálogo ya no existe. Recarga la página para ver el estado actual.';
    case 409:
      // El servidor explica el motivo: duplicado, versión fuera de validación o ya aprobada.
      return (
        message ??
        'La resolución cambió mientras la editabas. Recarga la página para ver el estado actual.'
      );
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_DOWN;
  }

  return GENERIC;
}
