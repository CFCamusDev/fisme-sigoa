import {
  PROTECTED_ROLE_CODE,
  PROTECTED_ROLE_REQUIRED_GRANTS,
  type PermissionScope,
  type RoleGrant,
} from '@sigoa/shared';
import { ProtectedRoleError } from '../errors/protected-role-error.js';

export { PROTECTED_ROLE_CODE, PROTECTED_ROLE_REQUIRED_GRANTS };

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

  const missingGrant = PROTECTED_ROLE_REQUIRED_GRANTS.some(
    (required) =>
      !desiredGrants.some(
        (g) => g.permissionCode === required.permissionCode && g.scope === required.scope,
      ),
  );

  if (missingGrant) {
    throw new ProtectedRoleError(
      'El rol Administrador debe conservar los permisos rol.ver y rol.editar con alcance Global.',
    );
  }
}
