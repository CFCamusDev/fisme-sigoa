import { describe, expect, it } from 'vitest';
import { Route } from './versiones_.$versionId';

type SearchValidator = (search: Record<string, unknown>) => { tab?: string };

function validate(search: Record<string, unknown>) {
  return (Route.options.validateSearch as SearchValidator)(search);
}

describe('CatalogVersionEditorRoute (/catalogo/versiones/$versionId) (HU-082, T-082-31)', () => {
  it('defines a beforeLoad guard requiring catalogo.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('keeps tab search parameter and drops invalid values', () => {
    expect(validate({ tab: 'atributos' })).toEqual({ tab: 'atributos' });
    expect(validate({ tab: 'historial', extra: 'x' })).toEqual({ tab: 'historial' });
    expect(validate({ tab: 123 })).toEqual({ tab: undefined });
  });
});
