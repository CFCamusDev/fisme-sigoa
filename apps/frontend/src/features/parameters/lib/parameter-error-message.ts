import type { ApiError } from '@/lib/api-error';

const GENERIC = 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';

/** Mensaje al usuario para los errores de lectura y guardado de parámetros (qué pasó y cómo corregirlo). */
export function getParameterErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  switch (apiErr.status) {
    case 400:
      return 'Los valores indicados no son válidos. Revisa los rangos y que los pesos sumen 100.';
    case 403:
      return 'No tienes permiso para modificar los parámetros.';
    case 404:
      return 'El semestre elegido ya no existe. Actualiza la página y elige otro semestre.';
    case 409:
      return 'Otra persona modificó estos parámetros al mismo tiempo. Actualiza la página y vuelve a intentarlo.';
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return 'No se pudieron guardar los parámetros por un problema del servidor. Intenta de nuevo en unos minutos.';
  }

  return GENERIC;
}
