import type { ActivationToken } from '../entities/activation-token.js';

export interface ActivationTokenRepository {
  add(token: ActivationToken): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<ActivationToken | null>;
  findByTokenHashForUpdate(tokenHash: string): Promise<ActivationToken | null>;
  /**
   * Persiste la transición de estado de un token (consumo o revocación).
   * La actualización debe ser condicional sobre un estado pendiente previo
   * (`usedAt IS NULL AND revokedAt IS NULL`). Si el registro ya fue consumido
   * o revocado concurrentemente, debe rechazar con `InvalidActivationTokenError`.
   */
  save(token: ActivationToken): Promise<void>;
  revokePendingByUserId(userId: string, revokedAt: Date): Promise<void>;
}
