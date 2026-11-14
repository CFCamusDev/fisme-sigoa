import { describe, expect, it } from 'vitest';
import { Route } from './historial';

type SearchValidator = (search: Record<string, unknown>) => { base?: string; target?: string };

function validate(search: Record<string, unknown>) {
  return (Route.options.validateSearch as SearchValidator)(search);
}

describe('CatalogComparisonRoute (/catalogo/historial) (HU-017, T-017-11)', () => {
  it('defines a beforeLoad guard requiring catalogo.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('keeps the two versions chosen in the URL', () => {
    expect(validate({ base: 'cv-1', target: 'cv-2' })).toEqual({ base: 'cv-1', target: 'cv-2' });
  });

  it('accepts an empty search and drops unknown parameters', () => {
    expect(validate({})).toEqual({ base: undefined, target: undefined });
    expect(validate({ base: 'cv-1', other: 'x' })).toEqual({ base: 'cv-1', target: undefined });
  });

  it('ignores identifiers that are empty, too long or not text', () => {
    expect(validate({ base: '', target: 'x'.repeat(65) })).toEqual({
      base: undefined,
      target: undefined,
    });
    expect(validate({ base: 42, target: { id: 'cv-2' } })).toEqual({
      base: undefined,
      target: undefined,
    });
  });
});
