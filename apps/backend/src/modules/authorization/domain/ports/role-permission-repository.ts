import type { DesiredGrant, GrantRecord, ReplaceGrantsResult } from './grant-types.js';

export type RoleGrantRecord = GrantRecord;
export type DesiredRoleGrant = DesiredGrant;
export type ReplaceRoleGrantsResult = ReplaceGrantsResult;

export interface RolePermissionRepository {
  findByRoleId(roleId: string): Promise<RoleGrantRecord[]>;
  replaceForRole(
    roleId: string,
    desired: DesiredRoleGrant[],
    actorId: string | null,
  ): Promise<ReplaceRoleGrantsResult>;
}
