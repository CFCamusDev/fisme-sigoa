import type { PermissionScope, RoleGrant } from '@sigoa/shared';
import { ProtectedRoleError } from '../errors/protected-role-error.js';

export const PROTECTED_ROLE_CODE = 'ADMINISTRATOR';

export interface GrantLike {
  readonly permissionCode: string;
  readonly scope: PermissionScope;
}

export function assertProtectedRoleKeepsRoleManagement(
  roleCode: string,
  desiredGrants: readonly GrantLike[] | readonly RoleGrant[],
): void {
  if (roleCode !== PROTECTED_ROLE_CODE) {
    return;
  }

  const hasGlobalRoleVer = desiredGrants.some(
    (g) => g.permissionCode === 'rol.ver' && g.scope === 'GLOBAL',
  );
  const hasGlobalRoleEditar = desiredGrants.some(
    (g) => g.permissionCode === 'rol.editar' && g.scope === 'GLOBAL',
  );

  if (!hasGlobalRoleVer || !hasGlobalRoleEditar) {
    throw new ProtectedRoleError(
      'El rol Administrador debe conservar los permisos rol.ver y rol.editar con alcance Global.',
    );
  }
}
