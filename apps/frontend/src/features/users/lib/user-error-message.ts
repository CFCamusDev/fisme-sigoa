import type { ApiError } from '@/lib/api-error';
import { readableApiMessage } from '@/lib/validation-errors';

export function getUserErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
  }

  const apiErr = error as ApiError;
  if (apiErr.status === 403) {
    return 'No tienes permiso para realizar esta acción.';
  }
  if (apiErr.status === 404) {
    return 'El usuario solicitado no fue encontrado.';
  }
  if (apiErr.status === 409) {
    return readableApiMessage(apiErr, 'Ya existe un usuario con estos datos.');
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

export function extractUserConflictField(error: unknown): 'email' | 'dni' | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const apiErr = error as ApiError;
  if (apiErr.status !== 409 && apiErr.code !== 'CONFLICT') {
    return null;
  }

  const message = (apiErr.message || '').toLowerCase();
  if (message.includes('correo') || message.includes('email')) {
    return 'email';
  }
  if (message.includes('dni')) {
    return 'dni';
  }
  return null;
}
