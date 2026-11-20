export type ProcessPermission =
  'ejecucion.ver' | 'ejecucion.crear' | 'cronograma.ver' | 'cronograma.editar';

export interface ProcessPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: ProcessPermission;
    scope: 'GLOBAL';
  }): Promise<void>;
}
