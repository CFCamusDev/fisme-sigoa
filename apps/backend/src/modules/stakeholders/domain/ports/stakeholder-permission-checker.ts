export interface StakeholderPermissionChecker {
  assertAllowed(params: {
    actorId: string;
    permission:
      | 'constituyente.ver'
      | 'constituyente.editar'
      | 'constituyente.importar'
      | 'documento.descargar';
    scope: 'GLOBAL';
  }): Promise<void>;
}
