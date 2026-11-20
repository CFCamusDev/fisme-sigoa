export interface CommitteePermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'comite.ver' | 'comite.editar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
