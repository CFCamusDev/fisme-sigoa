import type { RefreshToken } from '../entities/refresh-token.js';

export interface RefreshTokenRepository {
  add(token: RefreshToken): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  findByTokenHashForUpdate(tokenHash: string): Promise<RefreshToken | null>;
  save(token: RefreshToken): Promise<void>;
  /**
   * Revoca todas las sesiones activas (refresh tokens no revocados) de un usuario.
   * Retorna el número de sesiones revocadas (RS-005, RS-020, RNF-030).
   */
  revokeAllForUser(userId: string, now: Date): Promise<number>;
}
