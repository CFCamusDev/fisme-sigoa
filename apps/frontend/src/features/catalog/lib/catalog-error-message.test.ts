import { describe, expect, it } from 'vitest';
import { getCatalogErrorMessage } from './catalog-error-message';

describe('getCatalogErrorMessage (T-013-15)', () => {
  it.each([
    [400, /no es válida/],
    [403, /No tienes permiso/],
    [404, /programa de estudios/],
    [500, /problema del servidor/],
    [503, /problema del servidor/],
  ])('explains what happened and how to fix it for status %d', (status, pattern) => {
    expect(getCatalogErrorMessage({ status })).toMatch(pattern);
  });

  it('uses the server message for a 409', () => {
    expect(
      getCatalogErrorMessage({
        status: 409,
        message: 'Ya existe una versión del catálogo en Borrador o En validación.',
      }),
    ).toBe('Ya existe una versión del catálogo en Borrador o En validación.');
  });

  it('falls back to a clear message for a 409 without text', () => {
    expect(getCatalogErrorMessage({ status: 409, message: '  ' })).toMatch(
      /Borrador o En validación/,
    );
    expect(getCatalogErrorMessage({ status: 409 })).toMatch(/Borrador o En validación/);
  });

  it.each([undefined, null, 'texto', 42, {}, { status: 418 }])(
    'answers the generic message for %j',
    (error) => {
      expect(getCatalogErrorMessage(error)).toMatch(/error inesperado/);
    },
  );
});
