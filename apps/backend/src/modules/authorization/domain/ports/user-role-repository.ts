export interface UserRoleRecord {
  readonly roleId: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly roleStatus: 'ACTIVE' | 'INACTIVE';
}

export interface UserRoleRepository {
  findByUserId(userId: string): Promise<UserRoleRecord[]>;
  replaceForUser(
    userId: string,
    roleIds: string[],
    actorId: string | null,
  ): Promise<{ added: string[]; removed: string[] }>;
  countActiveHolders(roleId: string, excludingUserId: string): Promise<number>;
}
