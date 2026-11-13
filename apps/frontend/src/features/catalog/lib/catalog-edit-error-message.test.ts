import { describe, expect, it } from 'vitest';
import { getCatalogEditErrorMessage } from './catalog-error-message';

describe('getCatalogEditErrorMessage (HU-014, T-014-17)', () => {
  it.each([
    [400, /revisa los datos ingresados/i],
    [403, /no tienes permiso para editar el catálogo/i],
    [404, /ya no existe/i],
    [500, /problema del servidor/i],
  ])('explains what happened and how to fix it for status %d', (status, pattern) => {
    expect(getCatalogEditErrorMessage({ status })).toMatch(pattern);
  });

  it('uses the server message for a 409 (locked version, duplicated code, outdated order)', () => {
    expect(
      getCatalogEditErrorMessage({ status: 409, message: 'Esta versión está bloqueada.' }),
    ).toBe('Esta versión está bloqueada.');
  });

  it('falls back to a clear message for a 409 without text', () => {
    expect(getCatalogEditErrorMessage({ status: 409, message: ' ' })).toMatch(/recarga la página/i);
  });

  it('returns a generic message for unknown errors', () => {
    expect(getCatalogEditErrorMessage(undefined)).toMatch(/error inesperado/i);
    expect(getCatalogEditErrorMessage({ status: 418 })).toMatch(/error inesperado/i);
  });
});
