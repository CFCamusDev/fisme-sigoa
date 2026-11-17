export interface StakeholderPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'constituyente.ver' | 'constituyente.editar' | 'constituyente.importar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
