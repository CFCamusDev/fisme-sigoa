export interface AssertAllowedParams {
  actorId: string;
  permission: 'usuario.ver' | 'usuario.crear' | 'usuario.editar';
  scope: 'GLOBAL';
}

export interface PermissionChecker {
  assertAllowed(params: AssertAllowedParams): Promise<void>;
}
