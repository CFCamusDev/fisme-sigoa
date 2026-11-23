import type { ApiError } from '@/lib/api-error';
import { readableApiMessage } from '@/lib/validation-errors';

export function getRoleErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
  }

  const apiErr = error as ApiError;
  if (apiErr.status === 403) {
    return 'No tienes permiso para realizar esta acción.';
  }
  if (apiErr.status === 404) {
    return 'El rol solicitado no fue encontrado.';
  }
  if (apiErr.status === 409) {
    return readableApiMessage(apiErr, 'Ya existe un rol con ese nombre.');
  }
  if (apiErr.status === 400) {
    if (apiErr.details && typeof apiErr.details === 'string') {
      return readableApiMessage(apiErr.details, 'Los datos proporcionados son inválidos.');
    }
    return readableApiMessage(apiErr, 'Los datos proporcionados son inválidos.');
  }
  if (apiErr.message) {
    return readableApiMessage(
      apiErr,
      'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.',
    );
  }

  return 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
}

export function isRoleNameConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const apiErr = error as ApiError;
  return apiErr.status === 409 || apiErr.code === 'CONFLICT';
}
