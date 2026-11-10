import type { ApiError } from '@/lib/api-error';

export function getSemesterErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
  }

  const apiErr = error as ApiError;
  if (apiErr.status === 403) {
    return 'No tienes permiso para registrar semestres.';
  }
  if (apiErr.status === 409) {
    return (
      apiErr.message || 'Ya existe un semestre que entra en conflicto con los datos ingresados.'
    );
  }
  if (apiErr.status === 400) {
    if (apiErr.details && typeof apiErr.details === 'string') {
      return apiErr.details;
    }
    return apiErr.message || 'Los datos del semestre son inválidos.';
  }
  if (apiErr.message) {
    return apiErr.message;
  }

  return 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
}

export function extractSemesterConflictType(error: unknown): 'code' | 'overlap' | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const apiErr = error as ApiError;
  if (apiErr.status !== 409 && apiErr.code !== 'CONFLICT') {
    return null;
  }

  const message = (apiErr.message || '').toLowerCase();
  if (message.includes('superpone') || message.includes('rango') || message.includes('overlap')) {
    return 'overlap';
  }
  if (message.includes('código') || message.includes('codigo') || message.includes('code')) {
    return 'code';
  }
  return null;
}
