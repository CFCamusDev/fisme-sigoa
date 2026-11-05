import type { ActivationToken } from '../entities/activation-token.js';

export interface ActivationTokenRepository {
  add(token: ActivationToken): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<ActivationToken | null>;
  findByTokenHashForUpdate(tokenHash: string): Promise<ActivationToken | null>;
  save(token: ActivationToken): Promise<void>;
  revokePendingByUserId(userId: string, revokedAt: Date): Promise<void>;
}
