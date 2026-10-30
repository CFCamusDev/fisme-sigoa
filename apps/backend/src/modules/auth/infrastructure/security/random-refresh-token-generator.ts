import { createHash, randomBytes } from 'node:crypto';
import type {
  GeneratedRefreshToken,
  RefreshTokenGenerator,
} from '../../domain/ports/refresh-token-generator.js';

export class RandomRefreshTokenGenerator implements RefreshTokenGenerator {
  private readonly ttlDays: number;

  constructor(ttlDays: number) {
    this.ttlDays = ttlDays;
  }

  generate(now: Date): GeneratedRefreshToken {
    const rawBytes = randomBytes(32);
    const token = rawBytes.toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date(now.getTime() + this.ttlDays * 24 * 60 * 60 * 1000);

    return {
      token,
      tokenHash,
      expiresAt,
    };
  }
}
