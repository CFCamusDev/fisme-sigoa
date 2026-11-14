export interface CatalogPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission: 'catalogo.ver' | 'catalogo.editar' | 'resolucion.aprobar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
