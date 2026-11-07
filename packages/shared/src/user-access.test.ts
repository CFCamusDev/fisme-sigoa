import { describe, expect, it } from 'vitest';
import {
  assignUserPermissionsRequestSchema,
  assignUserRolesRequestSchema,
  effectiveAccessSourceSchema,
  userAccessSchema,
  userIdParamSchema,
  type UserAccessDto,
} from './user-access.js';

describe('User access contracts (HU-007, RF-007, RNF-008)', () => {
  const permissions = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      permissionCode: `test_${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}.ver`,
      scope: 'OWN' as const,
    }));

  it('trims user ids and accepts the identifier boundary', () => {
    expect(userIdParamSchema.parse({ id: ' user-id ' })).toEqual({ id: 'user-id' });
    expect(userIdParamSchema.parse({ id: 'a'.repeat(64) }).id).toBe('a'.repeat(64));
  });

  it.each([{ id: '' }, { id: ' ' }, { id: 'a'.repeat(65) }, { id: 'user', extra: true }, {}])(
    'rejects invalid user parameters %j',
    (input) => {
      expect(userIdParamSchema.safeParse(input).success).toBe(false);
    },
  );

  it('accepts one to ten unique role identifiers up to 64 characters', () => {
    expect(assignUserRolesRequestSchema.parse({ roleIds: ['role'] })).toEqual({
      roleIds: ['role'],
    });
    const roleIds = Array.from({ length: 10 }, (_, index) => `${index}`.padEnd(64, 'a'));
    expect(assignUserRolesRequestSchema.parse({ roleIds })).toEqual({ roleIds });
  });

  it.each([
    { roleIds: [] },
    { roleIds: [''] },
    { roleIds: [' '] },
    { roleIds: ['a'.repeat(65)] },
    { roleIds: ['role', 'role'] },
    { roleIds: Array.from({ length: 11 }, (_, index) => `role-${index}`) },
    { roleIds: ['role'], extra: true },
    {},
  ])('rejects invalid role assignments %j', (input) => {
    expect(assignUserRolesRequestSchema.safeParse(input).success).toBe(false);
  });

  it('accepts zero and two hundred direct permissions', () => {
    expect(assignUserPermissionsRequestSchema.parse({ permissions: [] })).toEqual({
      permissions: [],
    });
    const grants = permissions(200);
    expect(assignUserPermissionsRequestSchema.parse({ permissions: grants })).toEqual({
      permissions: grants,
    });
  });

  it.each([
    { permissions: permissions(201) },
    { permissions: [permissions(1)[0], permissions(1)[0]] },
    { permissions: [{ permissionCode: 'INVALID', scope: 'OWN' }] },
    { permissions: [{ permissionCode: 'usuario.ver', scope: 'OTHER' }] },
    { permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN', extra: true }] },
    { permissions: [{ permissionCode: `${'a'.repeat(61)}.ver`, scope: 'OWN' }] },
    { permissions: [], extra: true },
    {},
  ])('rejects invalid direct permission assignments %j', (input) => {
    expect(assignUserPermissionsRequestSchema.safeParse(input).success).toBe(false);
  });

  const empty: UserAccessDto = {
    userId: 'user',
    roles: [],
    directPermissions: [],
    effectivePermissions: [],
  };
  const full: UserAccessDto = {
    userId: 'user',
    roles: [
      { id: 'teacher', code: 'TEACHER', name: 'Docente', status: 'ACTIVE' },
      { id: 'committee', code: 'COMMITTEE', name: 'Comité', status: 'INACTIVE' },
    ],
    directPermissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }],
    effectivePermissions: [
      {
        permissionCode: 'usuario.ver',
        scope: 'GLOBAL',
        sources: [
          {
            kind: 'ROLE',
            roleId: 'teacher',
            roleCode: 'TEACHER',
            roleName: 'Docente',
            scope: 'GLOBAL',
          },
          { kind: 'DIRECT', scope: 'OWN' },
        ],
      },
    ],
  };

  it('accepts empty lists and complete responses including inactive assigned roles', () => {
    expect(userAccessSchema.parse(empty)).toEqual(empty);
    expect(userAccessSchema.parse(full)).toEqual(full);
  });

  it.each([
    { ...empty, roles: null },
    { ...empty, directPermissions: null },
    { ...empty, effectivePermissions: null },
    { ...empty, userId: null },
    { ...empty, extra: true },
    { ...empty, roles: [{ id: 'role', code: 'ROLE', name: 'Rol' }] },
    { ...empty, roles: [{ id: 'role', code: 'ROLE', name: 'Rol', status: 'OTHER' }] },
    {
      ...empty,
      effectivePermissions: [{ permissionCode: 'usuario.ver', scope: 'OWN', sources: [] }],
    },
    { ...full, roles: [{ ...full.roles[0], extra: true }] },
    { ...full, effectivePermissions: [{ ...full.effectivePermissions[0], extra: true }] },
  ])('rejects incomplete or unknown response fields %j', (input) => {
    expect(userAccessSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { kind: 'ROLE', roleId: 'teacher', roleName: 'Docente', scope: 'OWN' },
    { kind: 'ROLE', roleId: 'teacher', roleCode: 'TEACHER', scope: 'OWN' },
    { kind: 'DIRECT', scope: 'OWN', extra: true },
    { kind: 'DIRECT', scope: 'OTHER' },
    { kind: 'OTHER', scope: 'OWN' },
  ])('rejects incomplete and unknown access sources %j', (input) => {
    expect(effectiveAccessSourceSchema.safeParse(input).success).toBe(false);
  });
});
