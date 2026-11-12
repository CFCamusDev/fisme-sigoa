import { createHash, randomBytes } from 'node:crypto';
import { DEFAULT_ACTIVATION_TOKEN_LIFETIME_HOURS } from '../../domain/entities/activation-token.js';
import type {
  ActivationTokenGenerator,
  GeneratedActivationToken,
} from '../../domain/ports/activation-token-generator.js';

export class RandomActivationTokenGenerator implements ActivationTokenGenerator {
  public readonly lifetimeHours: number;

  constructor(lifetimeHours: number = DEFAULT_ACTIVATION_TOKEN_LIFETIME_HOURS) {
    this.lifetimeHours = lifetimeHours;
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generate(now: Date): GeneratedActivationToken {
    const rawBytes = randomBytes(32);
    const token = rawBytes.toString('base64url');
    const tokenHash = this.hash(token);
    const expiresAt = new Date(now.getTime() + this.lifetimeHours * 60 * 60 * 1000);

    return {
      token,
      tokenHash,
      expiresAt,
    };
  }
}
