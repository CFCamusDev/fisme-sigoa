import type { ApiError } from '@/lib/api-error';

export function getProgramErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
  }

  const apiErr = error as ApiError;
  if (apiErr.status === 403) {
    return 'No tienes permiso para realizar esta acción.';
  }
  if (apiErr.status === 404) {
    return 'No hay un programa configurado en el sistema.';
  }
  if (apiErr.status === 409) {
    return apiErr.message || 'Ya existe otro programa con el código especificado.';
  }
  if (apiErr.status === 400) {
    if (apiErr.details && typeof apiErr.details === 'string') {
      return apiErr.details;
    }
    return apiErr.message || 'Los datos proporcionados son inválidos.';
  }
  if (apiErr.message) {
    return apiErr.message;
  }

  return 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
}

export function extractProgramConflictField(error: unknown): 'code' | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const apiErr = error as ApiError;
  if (apiErr.status !== 409 && apiErr.code !== 'CONFLICT') {
    return null;
  }

  const message = (apiErr.message || '').toLowerCase();
  if (message.includes('código') || message.includes('codigo') || message.includes('code')) {
    return 'code';
  }
  return null;
}
