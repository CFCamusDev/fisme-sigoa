import { describe, expect, it } from 'vitest';
import { getRoleErrorMessage } from './role-error-message';

describe('getRoleErrorMessage (HU-006, T-006-20)', () => {
  it('returns friendly forbidden message on 403', () => {
    expect(getRoleErrorMessage({ status: 403 })).toBe(
      'No tienes permiso para realizar esta acción.',
    );
  });

  it('returns friendly not found message on 404', () => {
    expect(getRoleErrorMessage({ status: 404 })).toBe('El rol solicitado no fue encontrado.');
  });

  it('returns conflict message from server or fallback on 409', () => {
    expect(getRoleErrorMessage({ status: 409, message: 'Ya existe un rol con ese nombre.' })).toBe(
      'Ya existe un rol con ese nombre.',
    );

    expect(getRoleErrorMessage({ status: 409 })).toBe('Ya existe un rol con ese nombre.');
  });

  it('returns validation message or details on 400', () => {
    expect(getRoleErrorMessage({ status: 400, details: 'El nombre es obligatorio' })).toBe(
      'El nombre es obligatorio',
    );

    expect(getRoleErrorMessage({ status: 400, message: 'Datos inválidos' })).toBe(
      'Datos inválidos',
    );

    expect(getRoleErrorMessage({ status: 400 })).toBe('Los datos proporcionados son inválidos.');
  });

  it('returns fallback message for unknown or non-object errors', () => {
    expect(getRoleErrorMessage(null)).toBe(
      'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.',
    );
    expect(getRoleErrorMessage('error')).toBe(
      'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.',
    );
  });
});
