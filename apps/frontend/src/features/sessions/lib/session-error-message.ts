import { isApiError } from '@/lib/api-error';

export function getSessionErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return 'No se pudo completar la operación sobre la sesión. Intenta nuevamente.';
  }

  if (error.status === 400) {
    return error.message || 'Los datos de la sesión no son válidos. Revisa los campos ingresados.';
  }
  if (error.status === 403) {
    return 'No tienes permiso para registrar o editar sesiones.';
  }
  if (error.status === 404 || error.status === 409) {
    return error.message;
  }
  return error.message || 'Ocurrió un error inesperado al guardar la sesión.';
}
