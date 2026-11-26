import { describe, expect, it } from 'vitest';
import { parseTabParam, tabSearchSchema } from './tab-param';

describe('parseTabParam', () => {
  const allowed = ['datos', 'roles', 'permisos'] as const;

  it('returns the matching allowed tab when valid', () => {
    expect(parseTabParam('roles', allowed, 'datos')).toBe('roles');
  });

  it('falls back to the default for unknown, empty, array and script values', () => {
    expect(parseTabParam('otro', allowed, 'datos')).toBe('datos');
    expect(parseTabParam('', allowed, 'datos')).toBe('datos');
    expect(parseTabParam(undefined, allowed, 'datos')).toBe('datos');
    expect(parseTabParam(null, allowed, 'datos')).toBe('datos');
    expect(parseTabParam(['roles'], allowed, 'datos')).toBe('datos');
    expect(parseTabParam('<script>alert(1)</script>', allowed, 'datos')).toBe('datos');
  });

  it('validates tabSearchSchema catching oversized or non-string values', () => {
    expect(tabSearchSchema.parse({ tab: 'roles' })).toEqual({ tab: 'roles' });
    expect(tabSearchSchema.parse({ tab: 'x'.repeat(40) })).toEqual({ tab: undefined });
    expect(tabSearchSchema.parse({ tab: 123 })).toEqual({ tab: undefined });
  });
});
