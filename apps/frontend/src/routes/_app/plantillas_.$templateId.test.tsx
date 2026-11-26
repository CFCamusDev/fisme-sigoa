import { describe, expect, it } from 'vitest';
import { Route } from './plantillas_.$templateId';

type SearchValidator = (search: Record<string, unknown>) => { tab?: string };

function validate(search: Record<string, unknown>) {
  return (Route.options.validateSearch as SearchValidator)(search);
}

describe('TemplateEditorRoute (/plantillas/$templateId) (HU-082, T-082-24)', () => {
  it('defines a beforeLoad guard requiring plantilla.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('keeps a valid tab in search and drops unknown or invalid values', () => {
    expect(validate({ tab: 'variables' })).toEqual({ tab: 'variables' });
    expect(validate({ tab: 'contenido', extra: 'x' })).toEqual({ tab: 'contenido' });
    expect(validate({ tab: 42 })).toEqual({ tab: undefined });
  });
});
