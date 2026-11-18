export interface SessionPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'sesion.ver' | 'sesion.editar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
