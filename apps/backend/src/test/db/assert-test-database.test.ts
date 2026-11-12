import { describe, expect, it } from 'vitest';
import { assertTestDatabase } from './assert-test-database.js';

describe('assertTestDatabase', () => {
  it('accepts database URLs with database name ending in _test', () => {
    const validUrl = 'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';
    expect(assertTestDatabase(validUrl)).toBe(validUrl);

    const anotherValid = 'postgres://user:pass@127.0.0.1:5432/oeag_integration_test';
    expect(assertTestDatabase(anotherValid)).toBe(anotherValid);
  });

  it('rejects empty or missing URLs', () => {
    expect(() => assertTestDatabase(undefined)).toThrow(/No se ha especificado/i);
    expect(() => assertTestDatabase('')).toThrow(/No se ha especificado/i);
    expect(() => assertTestDatabase('   ')).toThrow(/No se ha especificado/i);
  });

  it('rejects invalid URL formats', () => {
    expect(() => assertTestDatabase('not-a-valid-url')).toThrow(/formato válido/i);
  });

  it('aborts when database name does not end in _test (e.g. sigoa_dev or sigoa_prod)', () => {
    expect(() =>
      assertTestDatabase('postgresql://postgres:postgres@localhost:5432/sigoa_dev?schema=public'),
    ).toThrow(/Operación abortada por seguridad.*sigoa_dev/i);

    expect(() =>
      assertTestDatabase('postgresql://postgres:postgres@localhost:5432/sigoa_prod'),
    ).toThrow(/Operación abortada por seguridad.*sigoa_prod/i);

    expect(() => assertTestDatabase('postgresql://postgres:postgres@localhost:5432/')).toThrow(
      /Operación abortada por seguridad/i,
    );
  });
});
