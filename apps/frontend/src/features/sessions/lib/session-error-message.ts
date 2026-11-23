import type { ApiError } from '@/lib/api-error';
import { readableApiMessage } from '@/lib/validation-errors';

const GENERIC = 'No se pudo completar la operación sobre la sesión. Intenta nuevamente.';
const SERVER_DOWN =
  'No se pudo completar la operación por un problema del servidor. Intenta de nuevo en unos minutos.';

function serverMessage(error: Partial<ApiError>): string | null {
  const candidate = readableApiMessage(error, '');
  return candidate.length > 0 ? candidate : null;
}

export function getSessionErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC;
  }

  const apiErr = error as Partial<ApiError>;
  const message = serverMessage(apiErr);

  switch (apiErr.status) {
    case 400:
      return message ?? 'Los datos de la sesión no son válidos. Revisa los campos ingresados.';
    case 403:
      return 'No tienes permiso para registrar o editar sesiones.';
    case 404:
    case 409:
      return message ?? GENERIC;
    default:
      break;
  }

  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return SERVER_DOWN;
  }

  return GENERIC;
}
