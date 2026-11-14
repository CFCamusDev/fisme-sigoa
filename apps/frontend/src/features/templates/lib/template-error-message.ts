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

/** Mensaje al usuario para los errores de consultar, guardar y publicar plantillas (HU-018). */
export function getTemplateErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  const message = serverMessage(apiErr);
  switch (apiErr.status) {
    case 400:
      // La política de contenido explica la causa (etiqueta, enlace o variable no permitidos).
      return message && message !== GENERIC_VALIDATION
        ? message
        : 'Revisa el contenido: no puede estar vacío ni superar los 40 000 caracteres.';
    case 403:
      return 'No tienes permiso para esta operación de plantillas.';
    case 404:
      return 'La plantilla o la versión ya no existe. Recarga la página para ver el estado actual.';
    case 409:
      // El servidor explica el motivo: el borrador cambió, ya se publicó o está bloqueado.
      return (
        message ??
        'La plantilla cambió mientras la editabas. Recarga la página para ver el estado actual.'
      );
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_DOWN;
  }

  return GENERIC;
}
