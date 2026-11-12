import { describe, expect, it } from 'vitest';
import { getUserAccessErrorMessage } from './user-access-error-message';

describe('getUserAccessErrorMessage (HU-007, T-007-16)', () => {
  it('returns forbidden message on 403', () => {
    const error = { status: 403, message: 'Forbidden' };
    expect(getUserAccessErrorMessage(error)).toBe(
      'No tienes permiso para modificar los accesos de este usuario.',
    );
  });

  it('returns not found message on 404', () => {
    const error = { status: 404, message: 'Not found' };
    expect(getUserAccessErrorMessage(error)).toBe('El usuario no existe o fue eliminado.');
  });

  it('returns server conflict message on 409', () => {
    const error = {
      status: 409,
      message: 'Debe existir al menos un usuario activo con el rol Administrador.',
    };
    expect(getUserAccessErrorMessage(error)).toBe(
      'Debe existir al menos un usuario activo con el rol Administrador.',
    );
  });

  it('returns validation message or server message on 400', () => {
    const error = { status: 400, message: 'La lista contiene permisos duplicados.' };
    expect(getUserAccessErrorMessage(error)).toBe('La lista contiene permisos duplicados.');

    const errorNoMsg = { status: 400 };
    expect(getUserAccessErrorMessage(errorNoMsg)).toBe('Los datos enviados no son válidos.');
  });

  it('returns generic message for unknown errors', () => {
    expect(getUserAccessErrorMessage(null)).toBe(
      'Ocurrió un error inesperado al actualizar los accesos.',
    );
    expect(getUserAccessErrorMessage(new Error('Network error'))).toBe(
      'Ocurrió un error inesperado al actualizar los accesos.',
    );
  });
});
