import { describe, expect, it } from 'vitest';
import { getParameterErrorMessage } from './parameter-error-message';

describe('getParameterErrorMessage (T-011-13)', () => {
  it.each([
    [400, /rangos.*100/],
    [403, /No tienes permiso/],
    [404, /semestre elegido ya no existe/],
    [409, /al mismo tiempo/],
    [500, /problema del servidor/],
    [503, /problema del servidor/],
  ])('explains what happened and how to fix it for status %d', (status, pattern) => {
    expect(getParameterErrorMessage({ status })).toMatch(pattern);
  });

  it('falls back to a generic message for unknown or non-object errors', () => {
    expect(getParameterErrorMessage(undefined)).toMatch(/error inesperado/);
    expect(getParameterErrorMessage('boom')).toMatch(/error inesperado/);
    expect(getParameterErrorMessage({ status: 418 })).toMatch(/error inesperado/);
  });
});
