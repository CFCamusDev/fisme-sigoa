import * as jose from 'jose';
import type {
  AccessTokenPayload,
  AccessTokenSigner,
  SignAccessTokenParams,
} from '../../domain/ports/access-token-signer.js';

export class JoseAccessTokenSigner implements AccessTokenSigner {
  private readonly secretKey: Uint8Array;
  private readonly ttlSeconds: number;

  constructor(secret: string, ttlSeconds: number) {
    this.secretKey = new TextEncoder().encode(secret);
    this.ttlSeconds = ttlSeconds;
  }

  async sign(params: SignAccessTokenParams, now: Date): Promise<AccessTokenPayload> {
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    const iatSeconds = Math.floor(now.getTime() / 1000);
    const expSeconds = Math.floor(expiresAt.getTime() / 1000);

    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(params.userId)
      .setIssuer('fisme-sigoa')
      .setIssuedAt(iatSeconds)
      .setExpirationTime(expSeconds)
      .sign(this.secretKey);

    return { token, expiresAt };
  }
}
