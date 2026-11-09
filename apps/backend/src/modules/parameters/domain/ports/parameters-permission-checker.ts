export interface ParametersPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'parametro.ver' | 'parametro.editar';
    scope?: 'GLOBAL';
  }): Promise<void>;
}
