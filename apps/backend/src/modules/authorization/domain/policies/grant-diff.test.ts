import { describe, expect, it } from 'vitest';
import { diffGrants } from './grant-diff.js';

describe('grant diff', () => {
  it('adds, removes and updates grants without changing the inputs', () => {
    const current = Object.freeze([
      Object.freeze({ id: 'a', permissionId: 'one', scope: 'OWN' as const }),
      Object.freeze({ id: 'b', permissionId: 'two', scope: 'GLOBAL' as const }),
      Object.freeze({ id: 'c', permissionId: 'three', scope: 'OWN' as const }),
    ]);
    const desired = Object.freeze([
      Object.freeze({ permissionId: 'three', scope: 'OWN' as const }),
      Object.freeze({ permissionId: 'one', scope: 'GLOBAL' as const }),
      Object.freeze({ permissionId: 'four', scope: 'OWN' as const }),
    ]);
    const before = JSON.stringify({ current, desired });
    expect(diffGrants(current, desired)).toEqual({
      toRemove: ['b'],
      toAdd: [{ permissionId: 'four', scope: 'OWN' }],
      toUpdate: [{ id: 'a', scope: 'GLOBAL' }],
    });
    expect(JSON.stringify({ current, desired })).toBe(before);
  });

  it('is idempotent for identical and empty sets', () => {
    expect(diffGrants([], [])).toEqual({ toRemove: [], toAdd: [], toUpdate: [] });
    expect(
      diffGrants(
        [{ id: 'a', permissionId: 'one', scope: 'OWN' }],
        [{ permissionId: 'one', scope: 'OWN' }],
      ),
    ).toEqual({ toRemove: [], toAdd: [], toUpdate: [] });
  });

  it('rejects duplicated desired permissions', () => {
    expect(() =>
      diffGrants(
        [],
        [
          { permissionId: 'one', scope: 'OWN' },
          { permissionId: 'one', scope: 'GLOBAL' },
        ],
      ),
    ).toThrow(/duplicados/);
  });

  it('preserves input order when removing and adding all grants', () => {
    expect(
      diffGrants(
        [
          { id: 'b', permissionId: 'two', scope: 'OWN' },
          { id: 'a', permissionId: 'one', scope: 'GLOBAL' },
        ],
        [
          { permissionId: 'four', scope: 'GLOBAL' },
          { permissionId: 'three', scope: 'OWN' },
        ],
      ),
    ).toEqual({
      toRemove: ['b', 'a'],
      toAdd: [
        { permissionId: 'four', scope: 'GLOBAL' },
        { permissionId: 'three', scope: 'OWN' },
      ],
      toUpdate: [],
    });
  });
});
