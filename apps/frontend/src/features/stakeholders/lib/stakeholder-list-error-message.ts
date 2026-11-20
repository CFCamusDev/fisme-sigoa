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

function capitalizeField(field: string): string {
  if (!field) {
    return field;
  }
  return field.charAt(0).toUpperCase() + field.slice(1);
}

/** Extrae los nombres de campos faltantes en español devueltos por el servidor (CA2). */
export function getMissingListMemberFields(error: unknown): string[] {
  if (!error || typeof error !== 'object') {
    return [];
  }
  const apiErr = error as Partial<ApiError>;
  if (apiErr.status !== 400 || !Array.isArray(apiErr.details)) {
    return [];
  }
  return apiErr.details
    .map((detail) => (typeof detail?.path === 'string' ? detail.path.trim() : ''))
    .filter((path) => path.length > 0)
    .map(capitalizeField);
}

/** Mensaje al usuario para los errores de listas del Anexo 3 (HU-022, HU-026). */
export function getStakeholderListErrorMessage(error: unknown, context?: 'pdf-download'): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  const message = serverMessage(apiErr);

  switch (apiErr.status) {
    case 400: {
      const missingFields = getMissingListMemberFields(error);
      if (missingFields.length > 0) {
        return `Falta en el registro del constituyente: ${missingFields.join(', ')}.`;
      }
      return message && message !== GENERIC_VALIDATION
        ? message
        : 'Revisa los datos ingresados para la lista.';
    }
    case 403:
      return context === 'pdf-download'
        ? 'No tienes permiso para descargar el PDF del Anexo 3.'
        : 'No tienes permiso para gestionar las listas del Anexo 3.';
    case 404:
      return 'La lista o el constituyente solicitado ya no existe. Recarga la página.';
    case 409:
      return (
        message ??
        (context === 'pdf-download'
          ? 'Ya hay una descarga en curso. Espera a que termine e intenta de nuevo.'
          : 'La operación entra en conflicto con el estado actual de la lista.')
      );
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_DOWN;
  }

  return GENERIC;
}
