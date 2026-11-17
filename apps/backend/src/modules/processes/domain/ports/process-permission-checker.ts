export interface ProcessPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'ejecucion.ver' | 'ejecucion.crear';
    scope: 'GLOBAL';
  }): Promise<void>;
}
