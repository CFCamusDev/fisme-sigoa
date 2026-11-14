export interface ResolutionPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'resolucion.ver' | 'resolucion.registrar' | 'resolucion.aprobar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
