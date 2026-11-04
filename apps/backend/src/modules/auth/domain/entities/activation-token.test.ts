import { describe, expect, it } from 'vitest';
import { ActivationToken, DEFAULT_ACTIVATION_TOKEN_LIFETIME_HOURS } from './activation-token.js';
import { InvalidActivationTokenError } from '../errors/invalid-activation-token-error.js';

describe('ActivationToken Entity (Domain Rules, RS-007, RS-016)', () => {
  const dummyUserId = 'user-uuid-1234';
  const dummyTokenHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  it('creates a token valid for 48 hours by default', () => {
    const fixedNow = new Date('2026-11-01T10:00:00.000Z');
    const token = ActivationToken.create({
      userId: dummyUserId,
      tokenHash: dummyTokenHash,
      now: fixedNow,
      createdBy: 'admin-uuid',
    });

    expect(token.id).toBeDefined();
    expect(token.userId).toBe(dummyUserId);
    expect(token.tokenHash).toBe(dummyTokenHash);
    expect(token.createdBy).toBe('admin-uuid');
    expect(token.createdAt).toEqual(fixedNow);
    expect(token.usedAt).toBeNull();
    expect(token.revokedAt).toBeNull();

    // 48 horas exactas
    const expectedExpiration = new Date('2026-11-03T10:00:00.000Z');
    expect(token.expiresAt).toEqual(expectedExpiration);
    expect(DEFAULT_ACTIVATION_TOKEN_LIFETIME_HOURS).toBe(48);

    // Es usable inmediatamente
    expect(token.isUsable(fixedNow)).toBe(true);
  });

  it('consumes a usable token once and marks usedAt', () => {
    const now = new Date('2026-11-01T10:00:00.000Z');
    const token = ActivationToken.create({
      userId: dummyUserId,
      tokenHash: dummyTokenHash,
      now,
    });

    const consumptionTime = new Date('2026-11-01T12:00:00.000Z');
    token.consume(consumptionTime);

    expect(token.usedAt).toEqual(consumptionTime);
    expect(token.isUsable(consumptionTime)).toBe(false);

    // Intentar consumir de nuevo debe fallar
    expect(() => token.consume(new Date('2026-11-01T12:05:00.000Z'))).toThrow(
      InvalidActivationTokenError,
    );
  });

  it('rejects an expired, used or revoked token with the same unified message (RS-007)', () => {
    const now = new Date('2026-11-01T10:00:00.000Z');

    // 1. Expirado
    const expiredToken = ActivationToken.create({
      userId: dummyUserId,
      tokenHash: dummyTokenHash,
      now,
    });
    const afterExpiration = new Date('2026-11-03T10:00:01.000Z'); // 48h + 1s
    expect(expiredToken.isUsable(afterExpiration)).toBe(false);
    expect(() => expiredToken.consume(afterExpiration)).toThrow(
      'El enlace de activación es inválido o ha expirado.',
    );

    // 2. Usado
    const usedToken = ActivationToken.create({
      userId: dummyUserId,
      tokenHash: dummyTokenHash,
      now,
    });
    usedToken.consume(new Date('2026-11-01T11:00:00.000Z'));
    expect(() => usedToken.consume(new Date('2026-11-01T12:00:00.000Z'))).toThrow(
      'El enlace de activación es inválido o ha expirado.',
    );

    // 3. Revocado
    const revokedToken = ActivationToken.create({
      userId: dummyUserId,
      tokenHash: dummyTokenHash,
      now,
    });
    revokedToken.revoke(new Date('2026-11-01T11:00:00.000Z'));
    expect(revokedToken.isUsable(new Date('2026-11-01T11:01:00.000Z'))).toBe(false);
    expect(() => revokedToken.consume(new Date('2026-11-01T12:00:00.000Z'))).toThrow(
      'El enlace de activación es inválido o ha expirado.',
    );
  });

  it('revoke is idempotent and preserves the initial revokedAt', () => {
    const now = new Date('2026-11-01T10:00:00.000Z');
    const token = ActivationToken.create({
      userId: dummyUserId,
      tokenHash: dummyTokenHash,
      now,
    });

    const firstRevoke = new Date('2026-11-01T11:00:00.000Z');
    token.revoke(firstRevoke);
    expect(token.revokedAt).toEqual(firstRevoke);

    const secondRevoke = new Date('2026-11-01T12:00:00.000Z');
    token.revoke(secondRevoke);
    expect(token.revokedAt).toEqual(firstRevoke);
  });

  it('restores token from persistence state', () => {
    const rawProps = {
      id: 'existing-token-id',
      userId: dummyUserId,
      tokenHash: dummyTokenHash,
      expiresAt: new Date('2026-11-05T00:00:00.000Z'),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date('2026-11-03T00:00:00.000Z'),
      createdBy: 'seed',
    };

    const token = ActivationToken.restore(rawProps);
    expect(token.id).toBe('existing-token-id');
    expect(token.userId).toBe(dummyUserId);
    expect(token.expiresAt).toEqual(rawProps.expiresAt);
    expect(token.isUsable(new Date('2026-11-04T00:00:00.000Z'))).toBe(true);
  });
});
