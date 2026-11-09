export interface PermissionCacheInvalidator {
  /**
   * Invalida las concesiones en caché para un usuario específico.
   */
  invalidateUser(userId: string): void;

  /**
   * Invalida todas las concesiones en caché (usado al modificar o cambiar estado de un rol).
   */
  invalidateAll(): void;
}
