import { describe, expect, it } from 'vitest';
import { Route } from './plantillas';

type SearchValidator = (search: Record<string, unknown>) => { id?: string };

function validate(search: Record<string, unknown>) {
  return (Route.options.validateSearch as SearchValidator)(search);
}

describe('TemplatesRoute (/plantillas) (HU-018, T-018-19)', () => {
  it('defines a beforeLoad guard requiring plantilla.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('keeps the open template in the URL', () => {
    expect(validate({ id: 'tpl-1' })).toEqual({ id: 'tpl-1' });
  });

  it('accepts an empty search and drops unknown parameters', () => {
    expect(validate({})).toEqual({ id: undefined });
    expect(validate({ id: 'tpl-1', other: 'x' })).toEqual({ id: 'tpl-1' });
  });

  it('ignores identifiers that are empty, too long or not text', () => {
    expect(validate({ id: '' })).toEqual({ id: undefined });
    expect(validate({ id: 'x'.repeat(65) })).toEqual({ id: undefined });
    expect(validate({ id: 42 })).toEqual({ id: undefined });
    expect(validate({ id: { value: 'tpl-1' } })).toEqual({ id: undefined });
  });
});
