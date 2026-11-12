import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_MATRIX,
  expandDefaultGrants,
  type MatrixRowDefinition,
} from './default-role-matrix.js';
import { isPermissionCode } from './permission-catalog.js';
import { DEFAULT_ROLE_PERMISSIONS } from './predefined-roles.js';

describe('Default Role Matrix Domain (T-006-06, T-006-23, CA1, LS 3.3)', () => {
  it('expands the LS 3.3 matrix into the expected grants per role', () => {
    const grants = expandDefaultGrants(DEFAULT_ROLE_MATRIX);

    const adminGrants = grants.filter((g) => g.roleCode === 'ADMINISTRATOR');
    const presGrants = grants.filter((g) => g.roleCode === 'COMMITTEE_PRESIDENT');
    const memberGrants = grants.filter((g) => g.roleCode === 'COMMITTEE_MEMBER');
    const directorGrants = grants.filter((g) => g.roleCode === 'PROGRAM_DIRECTOR');
    const teacherGrants = grants.filter((g) => g.roleCode === 'TEACHER');

    // Conteo verificado contra las 28 filas de LS 3.3:
    // Admin: 35 concesiones GLOBAL
    expect(adminGrants).toHaveLength(35);
    expect(adminGrants.every((g) => g.scope === 'GLOBAL')).toBe(true);

    // Presidente: 59 concesiones GLOBAL
    expect(presGrants).toHaveLength(59);
    expect(presGrants.every((g) => g.scope === 'GLOBAL')).toBe(true);

    // Miembro: 41 concesiones GLOBAL
    expect(memberGrants).toHaveLength(41);
    expect(memberGrants.every((g) => g.scope === 'GLOBAL')).toBe(true);

    // Director: 21 concesiones GLOBAL (solo lectura de todo + dashboard/reportes)
    expect(directorGrants).toHaveLength(21);
    expect(directorGrants.every((g) => g.scope === 'GLOBAL')).toBe(true);

    // Docente: 18 concesiones (5 GLOBAL en ver + 13 OWN en sus propios recursos)
    expect(teacherGrants).toHaveLength(18);
    const teacherGlobal = teacherGrants.filter((g) => g.scope === 'GLOBAL');
    const teacherOwn = teacherGrants.filter((g) => g.scope === 'OWN');
    expect(teacherGlobal).toHaveLength(5);
    expect(teacherOwn).toHaveLength(13);

    expect(grants).toHaveLength(35 + 59 + 41 + 21 + 18);
  });

  it('grants only catalogued permissions', () => {
    for (const grant of DEFAULT_ROLE_PERMISSIONS) {
      expect(isPermissionCode(grant.permissionCode)).toBe(true);
    }
  });

  it('a view cell grants only the view action', () => {
    const comiteGrantsMember = DEFAULT_ROLE_PERMISSIONS.filter(
      (g) => g.roleCode === 'COMMITTEE_MEMBER' && g.permissionCode.startsWith('comite.'),
    );
    expect(comiteGrantsMember).toHaveLength(1);
    expect(comiteGrantsMember[0]?.permissionCode).toBe('comite.ver');
  });

  it('a per-action cell applies action by action', () => {
    // Fila 7: ejecucion.ver / crear / avanzar para Miembro es L / ✔ / —
    const memberEjecucion = DEFAULT_ROLE_PERMISSIONS.filter(
      (g) => g.roleCode === 'COMMITTEE_MEMBER' && g.permissionCode.startsWith('ejecucion.'),
    );
    const codes = memberEjecucion.map((g) => g.permissionCode);
    expect(codes).toContain('ejecucion.ver');
    expect(codes).toContain('ejecucion.crear');
    expect(codes).not.toContain('ejecucion.avanzar');
  });

  it('teacher grants are OWN and never GLOBAL on editable resources', () => {
    const teacherGrants = DEFAULT_ROLE_PERMISSIONS.filter((g) => g.roleCode === 'TEACHER');

    // Los permisos de edición de docente deben ser todos OWN
    const teacherEditGrants = teacherGrants.filter((g) => !g.permissionCode.endsWith('.ver'));
    expect(teacherEditGrants.length).toBeGreaterThan(0);
    expect(teacherEditGrants.every((g) => g.scope === 'OWN')).toBe(true);
  });

  it('administrator cannot close or sign', () => {
    const adminGrants = DEFAULT_ROLE_PERMISSIONS.filter((g) => g.roleCode === 'ADMINISTRATOR');
    const codes = adminGrants.map((g) => g.permissionCode);

    expect(codes).not.toContain('ejecucion.cerrar');
    expect(codes).not.toContain('ejecucion.anular');
    expect(codes).not.toContain('acta.firmar');
    expect(codes).not.toContain('acta.anular');
  });

  it('president holds every acta and ejecucion permission', () => {
    const presGrants = DEFAULT_ROLE_PERMISSIONS.filter((g) => g.roleCode === 'COMMITTEE_PRESIDENT');
    const codes = presGrants.map((g) => g.permissionCode);

    expect(codes).toContain('acta.ver');
    expect(codes).toContain('acta.editar');
    expect(codes).toContain('acta.enviar_revision');
    expect(codes).toContain('acta.firmar');
    expect(codes).toContain('acta.anular');

    expect(codes).toContain('ejecucion.ver');
    expect(codes).toContain('ejecucion.crear');
    expect(codes).toContain('ejecucion.avanzar');
    expect(codes).toContain('ejecucion.cerrar');
    expect(codes).toContain('ejecucion.anular');
  });

  it('rejects a view cell on a row with no view action', () => {
    const invalidMatrix: readonly MatrixRowDefinition[] = [
      {
        label: 'accion_sin_ver',
        permissions: ['recurso.crear'],
        cells: {
          ADMINISTRATOR: 'VIEW',
          COMMITTEE_PRESIDENT: 'NONE',
          COMMITTEE_MEMBER: 'NONE',
          PROGRAM_DIRECTOR: 'NONE',
          TEACHER: 'NONE',
        },
      },
    ];

    expect(() => expandDefaultGrants(invalidMatrix)).toThrow(/does not have a "\.ver" action/);
  });

  it('rejects a per-action cell with the wrong length', () => {
    const invalidMatrix: readonly MatrixRowDefinition[] = [
      {
        label: 'accion_desajustada',
        permissions: ['recurso.ver', 'recurso.editar'],
        cells: {
          ADMINISTRATOR: ['GLOBAL'], // longitud 1 != 2
          COMMITTEE_PRESIDENT: 'NONE',
          COMMITTEE_MEMBER: 'NONE',
          PROGRAM_DIRECTOR: 'NONE',
          TEACHER: 'NONE',
        },
      },
    ];

    expect(() => expandDefaultGrants(invalidMatrix)).toThrow(/Inconsistent cell length/);
  });

  it('expansion is deterministic and has no duplicate role-permission pair', () => {
    const grants1 = expandDefaultGrants(DEFAULT_ROLE_MATRIX);
    const grants2 = expandDefaultGrants(DEFAULT_ROLE_MATRIX);

    expect(grants1).toEqual(grants2);

    const keys = new Set<string>();
    for (const g of grants1) {
      const key = `${g.roleCode}:${g.permissionCode}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });
});
