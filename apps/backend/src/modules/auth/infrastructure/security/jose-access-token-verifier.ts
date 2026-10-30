import * as jose from 'jose';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from '../../domain/ports/access-token-verifier.js';

export class JoseAccessTokenVerifier implements AccessTokenVerifier {
  private readonly secretKey: Uint8Array;

  constructor(secret: string) {
    this.secretKey = new TextEncoder().encode(secret);
  }

  async verify(token: string, now: Date): Promise<VerifiedAccessToken> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secretKey, {
        issuer: 'fisme-sigoa',
        algorithms: ['HS256'],
        currentDate: now,
      });

      if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
        throw new UnauthorizedError();
      }

      if (payload.exp === undefined || typeof payload.exp !== 'number') {
        throw new UnauthorizedError();
      }

      return {
        userId: payload.sub,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError();
    }
  }
}
