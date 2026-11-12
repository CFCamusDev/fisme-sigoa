import type { PermissionScope } from '../policies/effective-permissions.js';

export interface GrantRecord {
  readonly permissionId: string;
  readonly permissionCode: string;
  readonly scope: PermissionScope;
}
export interface DesiredGrant {
  readonly permissionId: string;
  readonly scope: PermissionScope;
}
export interface ReplaceGrantsResult {
  readonly added: number;
  readonly updated: number;
  readonly removed: number;
}
