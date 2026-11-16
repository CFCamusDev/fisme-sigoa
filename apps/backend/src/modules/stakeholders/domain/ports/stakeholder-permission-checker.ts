export interface StakeholderPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'constituyente.ver' | 'constituyente.editar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
