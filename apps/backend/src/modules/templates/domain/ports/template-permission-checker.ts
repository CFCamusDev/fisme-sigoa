export interface TemplatePermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'plantilla.ver' | 'plantilla.editar' | 'plantilla.publicar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
