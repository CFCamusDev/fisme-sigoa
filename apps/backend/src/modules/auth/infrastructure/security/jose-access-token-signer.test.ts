import { describe, expect, it } from 'vitest';
import * as jose from 'jose';
import { JoseAccessTokenSigner } from './jose-access-token-signer.js';

describe('JoseAccessTokenSigner (RNF-004, RS-016)', () => {
  const secret = 'test-secret-at-least-32-chars-long-123456789';
  const accessTtlSeconds = 900; // 15 minutos
  const signer = new JoseAccessTokenSigner(secret, accessTtlSeconds);

  it('signs a verifiable token that expires in 15 minutes', async () => {
    const now = new Date('2026-10-30T15:00:00.000Z');
    const { token, expiresAt } = await signer.sign({ userId: 'usr_abc_123' }, now);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(expiresAt).toEqual(new Date('2026-10-30T15:15:00.000Z'));

    const secretBytes = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretBytes, {
      issuer: 'fisme-sigoa',
      algorithms: ['HS256'],
    });

    expect(payload.sub).toBe('usr_abc_123');
    expect(payload.iss).toBe('fisme-sigoa');
    expect(payload.iat).toBe(Math.floor(now.getTime() / 1000));
    expect(payload.exp).toBe(Math.floor(now.getTime() / 1000) + 900);
  });

  it('contains only subject, issuer and standard timestamps without leaking personal data or roles', async () => {
    const now = new Date('2026-10-30T15:00:00.000Z');
    const { token } = await signer.sign({ userId: 'usr_minimal_claims' }, now);

    const secretBytes = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretBytes);

    const keys = Object.keys(payload);
    expect(keys).toEqual(expect.arrayContaining(['sub', 'iss', 'iat', 'exp']));
    expect(keys.length).toBe(4);
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('dni');
    expect(payload).not.toHaveProperty('roles');
  });

  it('rejects a token signed with another secret', async () => {
    const now = new Date('2026-10-30T15:00:00.000Z');
    const { token } = await signer.sign({ userId: 'usr_tampered' }, now);

    const wrongSecretBytes = new TextEncoder().encode(
      'wrong-secret-at-least-32-chars-long-987654321',
    );

    await expect(
      jose.jwtVerify(token, wrongSecretBytes, {
        issuer: 'fisme-sigoa',
        algorithms: ['HS256'],
      }),
    ).rejects.toThrow();
  });
});
