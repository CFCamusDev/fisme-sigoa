import { describe, expect, it } from 'vitest';
import {
  CATALOG_PERMISSIONS,
  getPermissionDefinition,
  isPermissionCode,
  isValidPermissionCodeFormat,
} from './catalog/permission-catalog.js';
import { DEFAULT_ROLE_PERMISSIONS, PREDEFINED_ROLES } from './catalog/predefined-roles.js';
import {
  computeEffectivePermissions,
  isGranted,
  type Grant,
} from './policies/effective-permissions.js';

describe('Authorization Domain Unit Tests (F2, RS-010, RS-011, RS-012, LS 3.2, LS 3.3)', () => {
  describe('Permission Catalog (RS-010)', () => {
    it('permission code format accepts resource.action and rejects others', () => {
      expect(isValidPermissionCodeFormat('usuario.ver')).toBe(true);
      expect(isValidPermissionCodeFormat('usuario.crear')).toBe(true);
      expect(isValidPermissionCodeFormat('usuario.editar')).toBe(true);
      expect(isValidPermissionCodeFormat('proceso.ejecucion.revisar')).toBe(true);

      expect(isValidPermissionCodeFormat('USUARIO.VER')).toBe(false);
      expect(isValidPermissionCodeFormat('usuariover')).toBe(false);
      expect(isValidPermissionCodeFormat('usuario.')).toBe(false);
      expect(isValidPermissionCodeFormat('.usuario')).toBe(false);
      expect(isValidPermissionCodeFormat('usuario..ver')).toBe(false);
      expect(isValidPermissionCodeFormat('usuario-ver')).toBe(false);
    });

    it('catalog contains the user permissions', () => {
      expect(isPermissionCode('usuario.ver')).toBe(true);
      expect(isPermissionCode('usuario.crear')).toBe(true);
      expect(isPermissionCode('usuario.editar')).toBe(true);
      expect(isPermissionCode('rol.ver')).toBe(true);
      expect(isPermissionCode('inexistente.accion')).toBe(false);

      const verDef = getPermissionDefinition('usuario.ver');
      expect(verDef).toBeDefined();
      expect(verDef?.module).toBe('M01 Seguridad');

      const rolVerDef = getPermissionDefinition('rol.ver');
      expect(rolVerDef).toBeDefined();
      expect(rolVerDef?.module).toBe('M01 Seguridad');

      const allCodes = CATALOG_PERMISSIONS.map((p) => p.code);
      expect(allCodes).toContain('usuario.ver');
      expect(allCodes).toContain('usuario.crear');
      expect(allCodes).toContain('usuario.editar');
      expect(allCodes).toContain('rol.ver');
    });
  });

  describe('Effective Permissions Policies (RS-011, RS-012)', () => {
    it('computes the union of grants', () => {
      const grants: Grant[] = [
        { permission: 'usuario.ver', scope: 'GLOBAL' },
        { permission: 'usuario.crear', scope: 'GLOBAL' },
      ];

      const effective = computeEffectivePermissions(grants);
      expect(effective.size).toBe(2);
      expect(effective.get('usuario.ver')).toBe('GLOBAL');
      expect(effective.get('usuario.crear')).toBe('GLOBAL');
    });

    it('global prevails over own for the same permission', () => {
      const grants: Grant[] = [
        { permission: 'usuario.editar', scope: 'OWN' },
        { permission: 'usuario.editar', scope: 'GLOBAL' },
      ];

      const effective = computeEffectivePermissions(grants);
      expect(effective.get('usuario.editar')).toBe('GLOBAL');

      // También si llegan en orden inverso
      const reverseGrants: Grant[] = [
        { permission: 'usuario.editar', scope: 'GLOBAL' },
        { permission: 'usuario.editar', scope: 'OWN' },
      ];
      const reverseEffective = computeEffectivePermissions(reverseGrants);
      expect(reverseEffective.get('usuario.editar')).toBe('GLOBAL');
    });

    it('own does not satisfy a global requirement', () => {
      const effective = computeEffectivePermissions([
        { permission: 'usuario.editar', scope: 'OWN' },
      ]);

      expect(isGranted(effective, 'usuario.editar', 'GLOBAL')).toBe(false);
    });

    it('global satisfies an own requirement', () => {
      const effective = computeEffectivePermissions([
        { permission: 'usuario.editar', scope: 'GLOBAL' },
      ]);

      expect(isGranted(effective, 'usuario.editar', 'OWN')).toBe(true);
      expect(isGranted(effective, 'usuario.editar', 'GLOBAL')).toBe(true);
    });

    it('no grants means nothing is granted', () => {
      const effective = computeEffectivePermissions([]);

      expect(isGranted(effective, 'usuario.ver', 'GLOBAL')).toBe(false);
      expect(isGranted(effective, 'usuario.ver', 'OWN')).toBe(false);
    });
  });

  describe('Predefined Roles & Default Matrix (LS 3.2, LS 3.3)', () => {
    it('predefined roles match the five roles of LS 3.2', () => {
      const codes = PREDEFINED_ROLES.map((r) => r.code);
      expect(codes).toEqual([
        'ADMINISTRATOR',
        'COMMITTEE_PRESIDENT',
        'COMMITTEE_MEMBER',
        'PROGRAM_DIRECTOR',
        'TEACHER',
      ]);
    });

    it('default matrix only references catalog permissions', () => {
      for (const grant of DEFAULT_ROLE_PERMISSIONS) {
        expect(isPermissionCode(grant.permissionCode)).toBe(true);
        expect(PREDEFINED_ROLES.some((r) => r.code === grant.roleCode)).toBe(true);
      }

      // El administrador tiene usuario.* y rol.* en GLOBAL
      const adminGrants = DEFAULT_ROLE_PERMISSIONS.filter((g) => g.roleCode === 'ADMINISTRATOR');
      expect(adminGrants).toHaveLength(4);
      expect(adminGrants.map((g) => g.permissionCode)).toEqual([
        'usuario.ver',
        'usuario.crear',
        'usuario.editar',
        'rol.ver',
      ]);
      expect(adminGrants.every((g) => g.scope === 'GLOBAL')).toBe(true);
    });
  });
});
