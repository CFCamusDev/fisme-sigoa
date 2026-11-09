import { userAccessSchema, type UserAccessDto } from '@sigoa/shared';
import {
  computeEffectiveAccess,
  type RoleGrantSource,
} from '../domain/policies/effective-access.js';
import type { UserRoleRepository } from '../domain/ports/user-role-repository.js';
import type { UserPermissionRepository } from '../domain/ports/user-permission-repository.js';
import type { RolePermissionRepository } from '../domain/ports/role-permission-repository.js';

export interface UserAccessAssemblerDependencies {
  readonly roles: UserRoleRepository;
  readonly direct: UserPermissionRepository;
  readonly rolePermissions: RolePermissionRepository;
}

export class UserAccessAssembler {
  constructor(private readonly deps: UserAccessAssemblerDependencies) {}

  async build(userId: string): Promise<UserAccessDto> {
    const roles = await this.deps.roles.findByUserId(userId);
    const direct = await this.deps.direct.findByUserId(userId);
    const roleSources: RoleGrantSource[] = [];
    for (const role of roles) {
      if (role.roleStatus === 'ACTIVE') {
        const grants = await this.deps.rolePermissions.findByRoleId(role.roleId);
        roleSources.push({
          roleId: role.roleId,
          roleCode: role.roleCode,
          roleName: role.roleName,
          grants: grants.map((grant) => ({ permission: grant.permissionCode, scope: grant.scope })),
        });
      }
    }
    const directGrants = direct.map((grant) => ({
      permission: grant.permissionCode,
      scope: grant.scope,
    }));
    const effective = computeEffectiveAccess(roleSources, directGrants);
    return userAccessSchema.parse({
      userId,
      roles: roles.map((role) => ({
        id: role.roleId,
        code: role.roleCode,
        name: role.roleName,
        status: role.roleStatus,
      })),
      directPermissions: direct.map((grant) => ({
        permissionCode: grant.permissionCode,
        scope: grant.scope,
      })),
      effectivePermissions: effective.map((entry) => ({
        permissionCode: entry.permission,
        scope: entry.scope,
        sources: entry.sources,
      })),
    });
  }
}
