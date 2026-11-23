import type { ApiError } from '@/lib/api-error';
import { readableApiMessage } from '@/lib/validation-errors';

const GENERIC_ERROR = 'No se pudo descargar el anexo en PDF. Por favor, intenta de nuevo.';
const SERVER_ERROR =
  'No se pudo generar el anexo por un problema del servidor. Intenta de nuevo en unos minutos.';

/** Devuelve el mensaje en español para los errores al descargar un anexo oficial en PDF (HU-070). */
export function getAnnexErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC_ERROR;
  }

  const apiErr = error as Partial<ApiError>;

  switch (apiErr.status) {
    case 400:
      return readableApiMessage(apiErr, 'El código de anexo solicitado no es válido.');
    case 403:
      return 'No tienes permiso para descargar anexos oficiales.';
    case 404:
      return 'El anexo no tiene una versión de plantilla publicada para descargar.';
    case 409:
      return readableApiMessage(apiErr, 'Ya estás generando un anexo. Espera a que termine.');
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_ERROR;
  }

  return GENERIC_ERROR;
}
