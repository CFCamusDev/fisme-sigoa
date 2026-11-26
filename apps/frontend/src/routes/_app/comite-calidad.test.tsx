import { describe, expect, it } from 'vitest';
import { Route } from './comite-calidad';

type SearchValidator = (search: Record<string, unknown>) => { tab?: string };

function validate(search: Record<string, unknown>) {
  return (Route.options.validateSearch as SearchValidator)(search);
}

describe('QualityCommitteeRoute (/comite-calidad) (HU-082, T-082-27)', () => {
  it('defines a beforeLoad guard requiring comite.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('keeps tab search parameter and drops unknown values', () => {
    expect(validate({ tab: 'historial' })).toEqual({ tab: 'historial' });
    expect(validate({ tab: 'vigente', extra: 'x' })).toEqual({ tab: 'vigente' });
    expect(validate({ tab: 123 })).toEqual({ tab: undefined });
  });
});
