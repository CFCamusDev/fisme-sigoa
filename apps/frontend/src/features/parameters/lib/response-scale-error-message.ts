import type { ApiError } from '@/lib/api-error';

const GENERIC = 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';

/** Mensaje al usuario para los errores de lectura y guardado de escalas (qué pasó y cómo corregirlo). */
export function getResponseScaleErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  switch (apiErr.status) {
    case 400:
      return 'Los datos de la escala no son válidos. Revisa el código, el nombre y los niveles.';
    case 403:
      return 'No tienes permiso para modificar las escalas.';
    case 404:
      return 'La escala ya no existe. Actualiza la página para ver las escalas vigentes.';
    case 409:
      // El servidor distingue «código repetido» de «escala en uso»; su mensaje ya dice qué hacer.
      return typeof apiErr.message === 'string' && apiErr.message.trim().length > 0
        ? apiErr.message
        : 'La escala no se pudo guardar porque entró en conflicto con otro cambio. Actualiza la página.';
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return 'No se pudo completar la operación por un problema del servidor. Intenta de nuevo en unos minutos.';
  }

  return GENERIC;
}
