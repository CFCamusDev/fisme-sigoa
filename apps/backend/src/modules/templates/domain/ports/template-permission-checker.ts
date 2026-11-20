export interface TemplatePermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'plantilla.ver' | 'plantilla.editar' | 'plantilla.publicar' | 'documento.descargar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
