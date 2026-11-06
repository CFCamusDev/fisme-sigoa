import { describe, expect, it } from 'vitest';
import { ProtectedRoleError } from '../errors/protected-role-error.js';
import {
  assertProtectedRoleKeepsRoleManagement,
  PROTECTED_ROLE_CODE,
} from './protected-role-grants.js';

describe('assertProtectedRoleKeepsRoleManagement (HU-006, T-006-11, D6, RF-006)', () => {
  it('accepts the administrator role keeping both permissions with global scope', () => {
    expect(() =>
      assertProtectedRoleKeepsRoleManagement(PROTECTED_ROLE_CODE, [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' },
        { permissionCode: 'rol.editar', scope: 'GLOBAL' },
        { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
      ]),
    ).not.toThrow();
  });

  it('rejects the administrator role when rol.ver is missing', () => {
    expect(() =>
      assertProtectedRoleKeepsRoleManagement(PROTECTED_ROLE_CODE, [
        { permissionCode: 'rol.editar', scope: 'GLOBAL' },
      ]),
    ).toThrow(ProtectedRoleError);
  });

  it('rejects the administrator role when rol.editar is missing', () => {
    expect(() =>
      assertProtectedRoleKeepsRoleManagement(PROTECTED_ROLE_CODE, [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' },
      ]),
    ).toThrow(ProtectedRoleError);
  });

  it('rejects the administrator role when rol.ver has OWN scope', () => {
    expect(() =>
      assertProtectedRoleKeepsRoleManagement(PROTECTED_ROLE_CODE, [
        { permissionCode: 'rol.ver', scope: 'OWN' },
        { permissionCode: 'rol.editar', scope: 'GLOBAL' },
      ]),
    ).toThrow(ProtectedRoleError);
  });

  it('rejects the administrator role when rol.editar has OWN scope', () => {
    expect(() =>
      assertProtectedRoleKeepsRoleManagement(PROTECTED_ROLE_CODE, [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' },
        { permissionCode: 'rol.editar', scope: 'OWN' },
      ]),
    ).toThrow(ProtectedRoleError);
  });

  it('ignores other roles even if both permissions are omitted or set to OWN', () => {
    expect(() =>
      assertProtectedRoleKeepsRoleManagement('TEACHER', [
        { permissionCode: 'rol.ver', scope: 'OWN' },
      ]),
    ).not.toThrow();

    expect(() => assertProtectedRoleKeepsRoleManagement('CUSTOM_ROLE', [])).not.toThrow();
  });
});
