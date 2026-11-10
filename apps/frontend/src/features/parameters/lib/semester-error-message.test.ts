import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { getSemesterErrorMessage, extractSemesterConflictType } from './semester-error-message';

describe('semester-error-message (unit tests, T-010-10)', () => {
  it('returns appropriate message for 403 Forbidden', () => {
    const error = new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Acceso denegado' });
    expect(getSemesterErrorMessage(error)).toBe('No tienes permiso para registrar semestres.');
  });

  it('returns server message for 409 Conflict', () => {
    const error = new ApiError({
      status: 409,
      code: 'CONFLICT',
      message: 'El rango de fechas se superpone con el semestre 2027-I (2027-03-01 a 2027-07-31).',
    });
    expect(getSemesterErrorMessage(error)).toBe(
      'El rango de fechas se superpone con el semestre 2027-I (2027-03-01 a 2027-07-31).',
    );
  });

  it('returns server message for 400 Bad Request', () => {
    const error = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'El código del semestre debe tener el formato AAAA-I o AAAA-II',
    });
    expect(getSemesterErrorMessage(error)).toBe(
      'El código del semestre debe tener el formato AAAA-I o AAAA-II',
    );
  });

  it('returns generic message for unknown or non-object errors', () => {
    expect(getSemesterErrorMessage(null)).toBe(
      'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.',
    );
    expect(getSemesterErrorMessage('string error')).toBe(
      'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.',
    );
  });

  describe('extractSemesterConflictType', () => {
    it('detects overlap conflict', () => {
      const error = new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'El rango de fechas se superpone con el semestre 2027-I',
      });
      expect(extractSemesterConflictType(error)).toBe('overlap');
    });

    it('detects duplicate code conflict', () => {
      const error = new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'Ya existe un semestre con el código 2027-I',
      });
      expect(extractSemesterConflictType(error)).toBe('code');
    });

    it('returns null for non-409 errors', () => {
      const error = new ApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'Error' });
      expect(extractSemesterConflictType(error)).toBeNull();
    });
  });
});
