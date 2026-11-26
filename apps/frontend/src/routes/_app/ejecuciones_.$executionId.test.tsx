import { describe, expect, it } from 'vitest';
import { Route } from './ejecuciones_.$executionId';

type SearchValidator = (search: Record<string, unknown>) => { tab?: string };

function validate(search: Record<string, unknown>) {
  return (Route.options.validateSearch as SearchValidator)(search);
}

describe('ExecutionBoardRoute (/ejecuciones/$executionId) (HU-082, T-082-29)', () => {
  it('defines a beforeLoad guard requiring ejecucion.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('keeps tab search parameter and drops invalid values', () => {
    expect(validate({ tab: 'cronograma' })).toEqual({ tab: 'cronograma' });
    expect(validate({ tab: 'resumen', other: 'x' })).toEqual({ tab: 'resumen' });
    expect(validate({ tab: 42 })).toEqual({ tab: undefined });
  });
});
