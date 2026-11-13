import type { ApiError } from '@/lib/api-error';

const GENERIC = 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';

/** Mensaje al usuario para los errores de lectura y creación de versiones (qué pasó y cómo corregirlo). */
export function getCatalogErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  switch (apiErr.status) {
    case 400:
      return 'La solicitud no es válida. Actualiza la página e inténtalo de nuevo.';
    case 403:
      return 'No tienes permiso para esta operación del catálogo.';
    case 404:
      return 'No hay un programa de estudios configurado. Pide al Administrador que lo registre.';
    case 409:
      // El servidor ya explica qué hacer (cerrar o aprobar la versión abierta).
      return typeof apiErr.message === 'string' && apiErr.message.trim().length > 0
        ? apiErr.message
        : 'Ya existe una versión en Borrador o En validación. Ciérrala o apruébala antes de crear otra.';
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return 'No se pudo completar la operación por un problema del servidor. Intenta de nuevo en unos minutos.';
  }

  return GENERIC;
}
