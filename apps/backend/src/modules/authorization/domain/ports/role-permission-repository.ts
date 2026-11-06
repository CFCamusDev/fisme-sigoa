import type { PermissionScope } from '@sigoa/shared';

export interface RoleGrantRecord {
  readonly permissionId: string;
  readonly permissionCode: string;
  readonly scope: PermissionScope;
}

export interface DesiredRoleGrant {
  readonly permissionId: string;
  readonly scope: PermissionScope;
}

export interface ReplaceRoleGrantsResult {
  readonly added: number;
  readonly updated: number;
  readonly removed: number;
}

export interface RolePermissionRepository {
  findByRoleId(roleId: string): Promise<RoleGrantRecord[]>;
  replaceForRole(
    roleId: string,
    desired: DesiredRoleGrant[],
    actorId: string | null,
  ): Promise<ReplaceRoleGrantsResult>;
}
