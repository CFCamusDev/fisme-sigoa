import { describe, expect, it } from 'vitest';
import {
  areUserRoleDraftsEqual,
  buildUserRolesDraft,
  countUserRoleChanges,
  isUserRoleSaveDisabled,
  toggleRoleInDraft,
} from './user-roles-draft';

describe('user-roles-draft helpers (HU-007, T-007-16)', () => {
  it('builds a Set of role IDs from an array', () => {
    const draft = buildUserRolesDraft(['role-1', 'role-2']);
    expect(draft.has('role-1')).toBe(true);
    expect(draft.has('role-2')).toBe(true);
    expect(draft.size).toBe(2);
  });

  it('toggles a role in draft (adds if absent, removes if present)', () => {
    const initial = buildUserRolesDraft(['role-1']);
    const added = toggleRoleInDraft(initial, 'role-2');
    expect(added.has('role-1')).toBe(true);
    expect(added.has('role-2')).toBe(true);

    const removed = toggleRoleInDraft(added, 'role-1');
    expect(removed.has('role-1')).toBe(false);
    expect(removed.has('role-2')).toBe(true);
  });

  it('checks if two drafts are equal', () => {
    const d1 = buildUserRolesDraft(['role-1', 'role-2']);
    const d2 = buildUserRolesDraft(['role-2', 'role-1']);
    const d3 = buildUserRolesDraft(['role-1']);

    expect(areUserRoleDraftsEqual(d1, d2)).toBe(true);
    expect(areUserRoleDraftsEqual(d1, d3)).toBe(false);
  });

  it('counts changes between base and current draft', () => {
    const base = buildUserRolesDraft(['role-1', 'role-2']);
    const current = buildUserRolesDraft(['role-2', 'role-3']); // role-1 quitado (+1), role-3 añadido (+1) = 2 cambios

    expect(countUserRoleChanges(base, current)).toBe(2);
    expect(countUserRoleChanges(base, base)).toBe(0);
  });

  it('disables save when no role is selected, when more than 10 roles, or when equal to base', () => {
    const base = buildUserRolesDraft(['role-1']);

    // Sin cambios
    expect(isUserRoleSaveDisabled(base, base)).toBe(true);

    // Con cambios válidos
    const modified = buildUserRolesDraft(['role-1', 'role-2']);
    expect(isUserRoleSaveDisabled(modified, base)).toBe(false);

    // 0 roles seleccionados
    const empty = new Set<string>();
    expect(isUserRoleSaveDisabled(empty, base)).toBe(true);

    // Más de 10 roles seleccionados
    const eleven = new Set(Array.from({ length: 11 }, (_, i) => `r-${i}`));
    expect(isUserRoleSaveDisabled(eleven, base)).toBe(true);
  });
});
