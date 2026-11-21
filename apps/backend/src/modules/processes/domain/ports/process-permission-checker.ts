export type ProcessPermission =
  | 'ejecucion.ver'
  | 'ejecucion.crear'
  | 'ejecucion.avanzar'
  | 'cronograma.ver'
  | 'cronograma.editar';

export interface ProcessPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: ProcessPermission;
    scope: 'GLOBAL';
  }): Promise<void>;
}
