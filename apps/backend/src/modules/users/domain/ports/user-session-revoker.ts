export interface UserSessionRevoker {
  /**
   * Revoca todas las sesiones (refresh tokens) activas del usuario indicado.
   * La operación es idempotente y devuelve el número total de sesiones revocadas.
   */
  revokeAllForUser(userId: string, now: Date): Promise<number>;
}
