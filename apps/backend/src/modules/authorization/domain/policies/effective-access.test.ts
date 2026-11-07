import { describe, expect, it } from 'vitest';
import { computeEffectiveAccess } from './effective-access.js';

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
});
