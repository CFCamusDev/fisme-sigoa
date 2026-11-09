import type { DesiredGrant, GrantRecord, ReplaceGrantsResult } from './grant-types.js';

export interface UserPermissionRepository {
  findByUserId(userId: string): Promise<GrantRecord[]>;
  replaceForUser(
    userId: string,
    desired: DesiredGrant[],
    actorId: string | null,
  ): Promise<ReplaceGrantsResult>;
}
