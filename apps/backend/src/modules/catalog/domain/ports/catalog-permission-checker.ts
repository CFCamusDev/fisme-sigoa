export interface CatalogPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'catalogo.ver' | 'catalogo.editar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
