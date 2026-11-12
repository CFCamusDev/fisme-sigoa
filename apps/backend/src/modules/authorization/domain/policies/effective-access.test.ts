import { describe, expect, it } from 'vitest';
import { computeEffectiveAccess, type RoleGrantSource } from './effective-access.js';
import {
  computeEffectivePermissions,
  type Grant,
  type PermissionScope,
} from './effective-permissions.js';

describe('Effective access (HU-007, RS-011, RS-012)', () => {
  it('returns no permissions without roles or direct grants', () => {
    expect(computeEffectiveAccess([], [])).toEqual([]);
  });

  it('merges two roles and one direct grant into the union', () => {
    expect(
      computeEffectiveAccess(
        [
          {
            roleId: 'teacher',
            roleCode: 'TEACHER',
            roleName: 'Docente',
            grants: [{ permission: 'usuario.ver', scope: 'OWN' }],
          },
          {
            roleId: 'committee',
            roleCode: 'COMMITTEE',
            roleName: 'Comité',
            grants: [
              { permission: 'usuario.ver', scope: 'GLOBAL' },
              { permission: 'rol.ver', scope: 'OWN' },
            ],
          },
        ],
        [{ permission: 'usuario.ver', scope: 'OWN' }],
      ),
    ).toEqual([
      {
        permission: 'rol.ver',
        scope: 'OWN',
        sources: [
          {
            kind: 'ROLE',
            roleId: 'committee',
            roleCode: 'COMMITTEE',
            roleName: 'Comité',
            scope: 'OWN',
          },
        ],
      },
      {
        permission: 'usuario.ver',
        scope: 'GLOBAL',
        sources: [
          {
            kind: 'ROLE',
            roleId: 'committee',
            roleCode: 'COMMITTEE',
            roleName: 'Comité',
            scope: 'GLOBAL',
          },
          {
            kind: 'ROLE',
            roleId: 'teacher',
            roleCode: 'TEACHER',
            roleName: 'Docente',
            scope: 'OWN',
          },
          { kind: 'DIRECT', scope: 'OWN' },
        ],
      },
    ]);
  });

  const role = (scope: PermissionScope): RoleGrantSource => ({
    roleId: 'teacher',
    roleCode: 'TEACHER',
    roleName: 'Docente',
    grants: [{ permission: 'usuario.ver', scope }],
  });

  it('retains a single role as the only source', () => {
    expect(computeEffectiveAccess([role('OWN')], [])).toEqual([
      {
        permission: 'usuario.ver',
        scope: 'OWN',
        sources: [
          {
            kind: 'ROLE',
            roleId: 'teacher',
            roleCode: 'TEACHER',
            roleName: 'Docente',
            scope: 'OWN',
          },
        ],
      },
    ]);
  });

  it.each([
    ['OWN', 'OWN', 'OWN'],
    ['OWN', 'GLOBAL', 'GLOBAL'],
    ['GLOBAL', 'OWN', 'GLOBAL'],
    ['GLOBAL', 'GLOBAL', 'GLOBAL'],
  ] as const)(
    'combines role %s and direct %s into %s',
    (roleScope, directScope, effectiveScope) => {
      expect(
        computeEffectiveAccess(
          [role(roleScope)],
          [{ permission: 'usuario.ver', scope: directScope }],
        ),
      ).toEqual([
        {
          permission: 'usuario.ver',
          scope: effectiveScope,
          sources: [
            {
              kind: 'ROLE',
              roleId: 'teacher',
              roleCode: 'TEACHER',
              roleName: 'Docente',
              scope: roleScope,
            },
            { kind: 'DIRECT', scope: directScope },
          ],
        },
      ]);
    },
  );

  it('accepts direct grants without roles and deduplicates their source', () => {
    const grant: Grant = { permission: 'usuario.ver', scope: 'OWN' };
    expect(computeEffectiveAccess([], [grant, grant])).toEqual([
      {
        permission: 'usuario.ver',
        scope: 'OWN',
        sources: [{ kind: 'DIRECT', scope: 'OWN' }],
      },
    ]);
  });

  it.each([
    ['OWN', 'GLOBAL'],
    ['GLOBAL', 'OWN'],
  ] as const)(
    'deduplicates repeated roles and direct sources with %s then %s scope',
    (first, second) => {
      const roles = [role(first), role(first), role(second)];
      const direct: Grant[] = [
        { permission: 'usuario.ver', scope: first },
        { permission: 'usuario.ver', scope: second },
      ];
      expect(computeEffectiveAccess(roles, direct)).toEqual([
        {
          permission: 'usuario.ver',
          scope: 'GLOBAL',
          sources: [
            {
              kind: 'ROLE',
              roleId: 'teacher',
              roleCode: 'TEACHER',
              roleName: 'Docente',
              scope: 'GLOBAL',
            },
            { kind: 'DIRECT', scope: 'GLOBAL' },
          ],
        },
      ]);
    },
  );

  it('orders permissions and role sources independently of input order', () => {
    const roles: RoleGrantSource[] = [
      { ...role('GLOBAL'), roleId: 'z', roleCode: 'ZZZ' },
      { ...role('OWN'), roleId: 'b', roleCode: 'AAA' },
      { ...role('OWN'), roleId: 'a', roleCode: 'AAA' },
    ];
    const direct: Grant[] = [
      { permission: 'usuario.ver', scope: 'OWN' },
      { permission: 'rol.ver', scope: 'GLOBAL' },
      { permission: 'acta.ver', scope: 'OWN' },
    ];
    const result = computeEffectiveAccess(roles, direct);
    expect(result.map(({ permission }) => permission)).toEqual([
      'acta.ver',
      'rol.ver',
      'usuario.ver',
    ]);
    expect(
      result[2]?.sources.map((source) => (source.kind === 'ROLE' ? source.roleId : source.kind)),
    ).toEqual(['a', 'b', 'z', 'DIRECT']);
    expect(computeEffectiveAccess([...roles].reverse(), [...direct].reverse())).toEqual(result);
  });

  it('does not mutate frozen inputs or share their grant objects', () => {
    const grant = Object.freeze({ permission: 'usuario.ver', scope: 'OWN' } as const);
    const source = Object.freeze({ ...role('OWN'), grants: Object.freeze([grant]) });
    const roles = Object.freeze([source]);
    const direct = Object.freeze([grant]);
    const before = JSON.stringify({ roles, direct });
    const result = computeEffectiveAccess(roles, direct);
    expect(result[0]).toMatchObject({ permission: 'usuario.ver', scope: 'OWN' });
    expect(result[0]?.sources).toEqual([
      { kind: 'ROLE', roleId: 'teacher', roleCode: 'TEACHER', roleName: 'Docente', scope: 'OWN' },
      { kind: 'DIRECT', scope: 'OWN' },
    ]);
    expect(result[0]?.sources[1]).not.toBe(grant);
    expect(JSON.stringify({ roles, direct })).toBe(before);
  });

  it('matches the existing effective permission computation without changing it', () => {
    const roles = [role('OWN'), { ...role('GLOBAL'), roleId: 'committee' }];
    const direct: Grant[] = [{ permission: 'rol.ver', scope: 'OWN' }];
    expect(
      new Map(
        computeEffectiveAccess(roles, direct).map(({ permission, scope }) => [permission, scope]),
      ),
    ).toEqual(computeEffectivePermissions([...roles.flatMap(({ grants }) => grants), ...direct]));
    expect(computeEffectiveAccess([{ ...role('OWN'), grants: [] }], [])).toEqual([]);
  });
});
