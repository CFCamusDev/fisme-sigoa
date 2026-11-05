import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { extractUserConflictField, getUserErrorMessage } from './user-error-message';

describe('user-error-message helpers (T-003-15)', () => {
  it('translates 403 status to a clear permission message', () => {
    const error = new ApiError({
      code: 'FORBIDDEN',
      message: 'No tienes permiso.',
      status: 403,
    });
    expect(getUserErrorMessage(error)).toBe('No tienes permiso para realizar esta acción.');
  });

  it('translates 404 status to a not found message', () => {
    const error = new ApiError({
      code: 'NOT_FOUND',
      message: 'Not found',
      status: 404,
    });
    expect(getUserErrorMessage(error)).toBe('El usuario solicitado no fue encontrado.');
  });

  it('preserves the server message on 409 conflict', () => {
    const error = new ApiError({
      code: 'CONFLICT',
      message: 'Ya existe otro usuario con este correo electrónico.',
      status: 409,
    });
    expect(getUserErrorMessage(error)).toBe('Ya existe otro usuario con este correo electrónico.');
  });

  it('extracts conflict field for email and dni', () => {
    const emailConflict = new ApiError({
      code: 'CONFLICT',
      message: 'Ya existe otro usuario con este correo electrónico.',
      status: 409,
    });
    expect(extractUserConflictField(emailConflict)).toBe('email');

    const dniConflict = new ApiError({
      code: 'CONFLICT',
      message: 'Ya existe otro usuario con este DNI registrado.',
      status: 409,
    });
    expect(extractUserConflictField(dniConflict)).toBe('dni');

    const otherConflict = new ApiError({
      code: 'CONFLICT',
      message: 'Conflicto genérico',
      status: 409,
    });
    expect(extractUserConflictField(otherConflict)).toBeNull();

    expect(extractUserConflictField(new Error('Unknown'))).toBeNull();
  });

  it('returns generic fallback for unknown errors', () => {
    expect(getUserErrorMessage(null)).toContain('error inesperado');
    expect(getUserErrorMessage({})).toContain('error inesperado');
  });
});
