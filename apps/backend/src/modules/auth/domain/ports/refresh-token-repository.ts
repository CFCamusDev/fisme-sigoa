import type { RefreshToken } from '../entities/refresh-token.js';

export interface RefreshTokenRepository {
  add(token: RefreshToken): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
}
