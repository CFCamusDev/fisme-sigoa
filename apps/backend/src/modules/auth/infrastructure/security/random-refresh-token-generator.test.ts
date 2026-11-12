import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { RandomRefreshTokenGenerator } from './random-refresh-token-generator.js';

describe('RandomRefreshTokenGenerator (RS-016, RNF-004)', () => {
  const refreshTtlDays = 7;
  const generator = new RandomRefreshTokenGenerator(refreshTtlDays);

  it('generates a 32-byte cryptographically secure token and its SHA-256 hash', () => {
    const now = new Date('2026-10-30T15:00:00.000Z');
    const result = generator.generate(now);

    expect(result.token).toBeDefined();
    // 32 bytes en base64url son 43 caracteres
    expect(result.token.length).toBeGreaterThanOrEqual(43);

    // El hash SHA-256 son 64 caracteres hexadecimales
    expect(result.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    const expectedHash = createHash('sha256').update(result.token).digest('hex');
    expect(result.tokenHash).toBe(expectedHash);

    // Expira exactamente a los 7 días
    const expectedExpiresAt = new Date('2026-11-06T15:00:00.000Z');
    expect(result.expiresAt).toEqual(expectedExpiresAt);
  });

  it('hash matches the hash returned by generate', () => {
    const now = new Date('2026-10-30T15:00:00.000Z');
    const { token, tokenHash } = generator.generate(now);

    const computedHash = generator.hash(token);
    expect(computedHash).toBe(tokenHash);
  });

  it('generates distinct tokens on consecutive calls', () => {
    const now = new Date('2026-10-30T15:00:00.000Z');
    const first = generator.generate(now);
    const second = generator.generate(now);

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });
});
