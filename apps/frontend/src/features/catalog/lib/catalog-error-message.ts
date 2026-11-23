import type { ApiError } from '@/lib/api-error';
import { readableApiMessage } from '@/lib/validation-errors';

const GENERIC = 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
const SERVER_DOWN =
  'No se pudo completar la operación por un problema del servidor. Intenta de nuevo en unos minutos.';

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
      return readableApiMessage(
        apiErr,
        'Ya existe una versión en Borrador o En validación. Ciérrala o apruébala antes de crear otra.',
      );
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_DOWN;
  }

  return GENERIC;
}

/** Mensaje al usuario para los errores al guardar u ordenar OE y AG de una versión (HU-014). */
export function getCatalogEditErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  switch (apiErr.status) {
    case 400:
      return 'Revisa los datos ingresados: el código, el nombre y el enunciado deben cumplir los límites indicados.';
    case 403:
      return 'No tienes permiso para editar el catálogo.';
    case 404:
      return 'La versión o el elemento ya no existe. Recarga la página para ver el estado actual.';
    case 409:
      // El servidor explica el motivo: versión bloqueada, código repetido, orden desfasado o tope.
      return readableApiMessage(
        apiErr,
        'No se pudo guardar porque la versión cambió. Recarga la página e inténtalo de nuevo.',
      );
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_DOWN;
  }

  return GENERIC;
}
