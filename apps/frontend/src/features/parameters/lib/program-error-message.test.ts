import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { extractProgramConflictField, getProgramErrorMessage } from './program-error-message';

describe('program-error-message (T-009-11)', () => {
  it('returns appropriate message for 403 Forbidden', () => {
    const error = new ApiError({
      code: 'FORBIDDEN',
      message: 'No autorizado',
      status: 403,
    });
    expect(getProgramErrorMessage(error)).toBe('No tienes permiso para realizar esta acción.');
  });

  it('returns appropriate message for 404 Not Found', () => {
    const error = new ApiError({
      code: 'NOT_FOUND',
      message: 'No encontrado',
      status: 404,
    });
    expect(getProgramErrorMessage(error)).toBe('No hay un programa configurado en el sistema.');
  });

  it('returns conflict message for 409 Conflict', () => {
    const error = new ApiError({
      code: 'CONFLICT',
      message: 'Ya existe otro programa con el código especificado',
      status: 409,
    });
    expect(getProgramErrorMessage(error)).toBe(
      'Ya existe otro programa con el código especificado',
    );
  });

  it('returns string details or message for 400 Validation Error', () => {
    const errorWithDetails = new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Datos inválidos',
      status: 400,
      details: 'El nombre debe tener al menos 3 caracteres',
    });
    expect(getProgramErrorMessage(errorWithDetails)).toBe(
      'El nombre debe tener al menos 3 caracteres',
    );

    const errorWithMessage = new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Cuerpo requerido',
      status: 400,
    });
    expect(getProgramErrorMessage(errorWithMessage)).toBe('Cuerpo requerido');
  });

  it('falls back to generic error message for unknown or null errors', () => {
    expect(getProgramErrorMessage(null)).toBe(
      'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.',
    );
    expect(getProgramErrorMessage(undefined)).toBe(
      'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.',
    );
    expect(getProgramErrorMessage({})).toBe(
      'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.',
    );
  });

  describe('extractProgramConflictField', () => {
    it('returns code when message mentions código or code', () => {
      const error1 = new ApiError({
        code: 'CONFLICT',
        message: 'Ya existe un programa con el código especificado',
        status: 409,
      });
      expect(extractProgramConflictField(error1)).toBe('code');

      const error2 = new ApiError({
        code: 'CONFLICT',
        message: 'El code especificado ya está registrado',
        status: 409,
      });
      expect(extractProgramConflictField(error2)).toBe('code');
    });

    it('returns null for non-conflict errors or other messages', () => {
      const notConflict = new ApiError({
        code: 'NOT_FOUND',
        message: 'No encontrado',
        status: 404,
      });
      expect(extractProgramConflictField(notConflict)).toBeNull();

      const genericConflict = new ApiError({
        code: 'CONFLICT',
        message: 'Conflicto de entidad',
        status: 409,
      });
      expect(extractProgramConflictField(genericConflict)).toBeNull();
    });
  });
});
