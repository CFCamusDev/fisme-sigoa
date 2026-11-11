import { describe, expect, it } from 'vitest';
import { getResponseScaleErrorMessage } from './response-scale-error-message';

describe('getResponseScaleErrorMessage (T-012-16)', () => {
  it.each([
    [400, /no son válidos.*niveles/],
    [403, /No tienes permiso/],
    [404, /ya no existe/],
    [500, /problema del servidor/],
    [503, /problema del servidor/],
  ])('explains what happened and how to fix it for status %d', (status, pattern) => {
    expect(getResponseScaleErrorMessage({ status })).toMatch(pattern);
  });

  it('uses the server message for a 409, which tells a repeated code from an in-use scale', () => {
    expect(
      getResponseScaleErrorMessage({
        status: 409,
        message: 'La escala está en uso en una encuesta publicada. Duplícala para crear una nueva',
      }),
    ).toMatch(/Duplícala/);
  });

  it('falls back to a clear message for a 409 without text', () => {
    expect(getResponseScaleErrorMessage({ status: 409, message: '  ' })).toMatch(
      /Actualiza la página/,
    );
    expect(getResponseScaleErrorMessage({ status: 409 })).toMatch(/Actualiza la página/);
  });

  it('falls back to a generic message for unknown or non-object errors', () => {
    expect(getResponseScaleErrorMessage(undefined)).toMatch(/error inesperado/);
    expect(getResponseScaleErrorMessage('boom')).toMatch(/error inesperado/);
    expect(getResponseScaleErrorMessage({ status: 418 })).toMatch(/error inesperado/);
  });
});
