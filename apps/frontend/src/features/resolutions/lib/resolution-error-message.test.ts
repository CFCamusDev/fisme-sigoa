import { describe, expect, it } from 'vitest';
import { getResolutionErrorMessage } from './resolution-error-message';

describe('getResolutionErrorMessage (T-048-13)', () => {
  it.each([
    [403, /No tienes permiso/],
    [404, /ya no existe/],
    [500, /problema del servidor/],
    [503, /problema del servidor/],
  ])('explains what happened and how to fix it for status %d', (status, pattern) => {
    expect(getResolutionErrorMessage({ status })).toMatch(pattern);
  });

  it('uses the server message for a specific 400 (pdf required)', () => {
    expect(
      getResolutionErrorMessage({
        status: 400,
        message: 'Para aprobar la resolución debes adjuntar el PDF firmado.',
      }),
    ).toBe('Para aprobar la resolución debes adjuntar el PDF firmado.');
  });

  it('uses a guide message for the generic validation 400', () => {
    expect(
      getResolutionErrorMessage({
        status: 400,
        message: 'La solicitud contiene errores de validación',
      }),
    ).toMatch(/Revisa los datos/);
    expect(getResolutionErrorMessage({ status: 400 })).toMatch(/Revisa los datos/);
  });

  it('uses the server message for a 409', () => {
    expect(
      getResolutionErrorMessage({ status: 409, message: 'La resolución ya está aprobada.' }),
    ).toBe('La resolución ya está aprobada.');
  });

  it('falls back to a clear message for a 409 without text', () => {
    expect(getResolutionErrorMessage({ status: 409, message: '  ' })).toMatch(/Recarga la página/);
  });

  it('answers a generic message for unknown or empty errors', () => {
    expect(getResolutionErrorMessage(null)).toMatch(/error inesperado/);
    expect(getResolutionErrorMessage({ status: 418 })).toMatch(/error inesperado/);
  });
});
