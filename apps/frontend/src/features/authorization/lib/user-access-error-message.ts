import { readableApiMessage } from '@/lib/validation-errors';

export function getUserAccessErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: number }).status;

    if (status === 403) {
      return 'No tienes permiso para modificar los accesos de este usuario.';
    }

    if (status === 404) {
      return 'El usuario no existe o fue eliminado.';
    }

    if (status === 409) {
      return readableApiMessage(
        error,
        'Debe existir al menos un usuario activo con el rol Administrador.',
      );
    }

    if (status === 400) {
      return readableApiMessage(error, 'Los datos enviados no son válidos.');
    }
  }

  return 'Ocurrió un error inesperado al actualizar los accesos.';
}
