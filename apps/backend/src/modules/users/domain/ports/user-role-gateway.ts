export interface UserRoleGateway {
  replaceRoles(userId: string, roleIds: string[]): Promise<void>;
  getRoleIds(userIds: string[]): Promise<Map<string, string[]>>;
}
