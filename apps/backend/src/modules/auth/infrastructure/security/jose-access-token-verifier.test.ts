import { describe, expect, it } from 'vitest';
import * as jose from 'jose';
import { JoseAccessTokenVerifier } from './jose-access-token-verifier.js';
import { JoseAccessTokenSigner } from './jose-access-token-signer.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';

describe('JoseAccessTokenVerifier (RNF-004, RNF-009, RS-016)', () => {
  const secret = 'super-secret-jwt-key-at-least-32-chars-long-123456';
  const accessTtlSeconds = 900; // 15 minutos
  const signer = new JoseAccessTokenSigner(secret, accessTtlSeconds);
  const verifier = new JoseAccessTokenVerifier(secret);

  const baseNow = new Date('2026-10-30T15:00:00.000Z');

  it('verifies a token signed by the signer', async () => {
    const { token } = await signer.sign({ userId: 'usr_abc_123' }, baseNow);
    const verified = await verifier.verify(token, baseNow);

    expect(verified.userId).toBe('usr_abc_123');
  });

  it('rejects an expired token', async () => {
    const { token } = await signer.sign({ userId: 'usr_abc_123' }, baseNow);
    const futureTime = new Date('2026-10-30T15:15:01.000Z'); // 1 segundo después de los 15 minutos

    await expect(verifier.verify(token, futureTime)).rejects.toThrow(UnauthorizedError);
  });

  it('rejects a token with a bad signature', async () => {
    const wrongVerifier = new JoseAccessTokenVerifier(
      'wrong-secret-key-at-least-32-chars-long-987654321',
    );
    const { token } = await signer.sign({ userId: 'usr_abc_123' }, baseNow);

    await expect(wrongVerifier.verify(token, baseNow)).rejects.toThrow(UnauthorizedError);
  });

  it('rejects a token with another issuer', async () => {
    const secretBytes = new TextEncoder().encode(secret);
    const foreignToken = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('usr_foreign')
      .setIssuer('foreign-system')
      .setIssuedAt(Math.floor(baseNow.getTime() / 1000))
      .setExpirationTime(Math.floor(baseNow.getTime() / 1000) + 900)
      .sign(secretBytes);

    await expect(verifier.verify(foreignToken, baseNow)).rejects.toThrow(UnauthorizedError);
  });

  it('rejects a token without subject', async () => {
    const secretBytes = new TextEncoder().encode(secret);
    const emptySubToken = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('fisme-sigoa')
      .setIssuedAt(Math.floor(baseNow.getTime() / 1000))
      .setExpirationTime(Math.floor(baseNow.getTime() / 1000) + 900)
      .sign(secretBytes);

    await expect(verifier.verify(emptySubToken, baseNow)).rejects.toThrow(UnauthorizedError);
  });

  it('rejects alg none and other algorithms', async () => {
    // Unsecured token (alg: 'none')
    const unsecuredHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url',
    );
    const unsecuredPayload = Buffer.from(
      JSON.stringify({
        sub: 'usr_attacker',
        iss: 'fisme-sigoa',
        exp: Math.floor(baseNow.getTime() / 1000) + 900,
      }),
    ).toString('base64url');
    const unsecuredToken = `${unsecuredHeader}.${unsecuredPayload}.`;

    await expect(verifier.verify(unsecuredToken, baseNow)).rejects.toThrow(UnauthorizedError);
  });
});
