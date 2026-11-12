import { describe, expect, it } from 'vitest';
import { RefreshToken } from './refresh-token.js';
import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token-error.js';

describe('RefreshToken Entity', () => {
  it('creates and restores refresh token entity with getters', () => {
    const expiresAt = new Date('2026-11-06T00:00:00.000Z');
    const token = RefreshToken.create({
      userId: 'usr_1',
      tokenHash: 'hash123',
      expiresAt,
      createdByIp: '10.0.0.1',
    });

    expect(token.id).toBeDefined();
    expect(token.userId).toBe('usr_1');
    expect(token.tokenHash).toBe('hash123');
    expect(token.expiresAt).toEqual(expiresAt);
    expect(token.revokedAt).toBeNull();
    expect(token.createdByIp).toBe('10.0.0.1');

    const restored = RefreshToken.restore({
      id: 'rt_custom_id',
      userId: 'usr_2',
      tokenHash: 'hash456',
      expiresAt,
      revokedAt: new Date('2026-11-01T00:00:00.000Z'),
      createdAt: new Date('2026-10-30T00:00:00.000Z'),
      createdByIp: null,
    });

    expect(restored.id).toBe('rt_custom_id');
    expect(restored.revokedAt).toEqual(new Date('2026-11-01T00:00:00.000Z'));
    expect(restored.createdAt).toEqual(new Date('2026-10-30T00:00:00.000Z'));
    expect(restored.createdByIp).toBeNull();
  });

  describe('Rotation and Revocation (RF-002, RS-016, RNF-004)', () => {
    const now = new Date('2026-10-30T15:00:00.000Z');
    const expiresAt = new Date('2026-11-06T15:00:00.000Z');

    it('rotates a usable token into a new one and revokes the old', () => {
      const token = RefreshToken.create({
        userId: 'usr_user_1',
        tokenHash: 'old_hash',
        expiresAt,
        createdByIp: '192.168.1.10',
      });

      const nextExpiresAt = new Date('2026-11-13T15:00:00.000Z');
      const rotated = token.rotate(now, {
        tokenHash: 'new_hash',
        expiresAt: nextExpiresAt,
        createdByIp: '192.168.1.20',
      });

      expect(token.isRevoked()).toBe(true);
      expect(token.revokedAt).toEqual(now);
      expect(token.isUsable(now)).toBe(false);

      expect(rotated.id).toBeDefined();
      expect(rotated.id).not.toBe(token.id);
      expect(rotated.userId).toBe('usr_user_1');
      expect(rotated.tokenHash).toBe('new_hash');
      expect(rotated.expiresAt).toEqual(nextExpiresAt);
      expect(rotated.revokedAt).toBeNull();
      expect(rotated.isUsable(now)).toBe(true);
    });

    it('keeps the user id and records the new ip on rotation', () => {
      const token = RefreshToken.create({
        userId: 'usr_user_keep',
        tokenHash: 'hash_original',
        expiresAt,
        createdByIp: '127.0.0.1',
      });

      const rotated = token.rotate(now, {
        tokenHash: 'hash_rotated',
        expiresAt: new Date('2026-11-13T15:00:00.000Z'),
        createdByIp: '10.0.0.99',
      });

      expect(rotated.userId).toBe('usr_user_keep');
      expect(rotated.createdByIp).toBe('10.0.0.99');
    });

    it('rejects an expired token', () => {
      const pastExpiresAt = new Date('2026-10-25T15:00:00.000Z');
      const token = RefreshToken.create({
        userId: 'usr_user_exp',
        tokenHash: 'hash_expired',
        expiresAt: pastExpiresAt,
      });

      expect(token.isExpired(now)).toBe(true);
      expect(token.isUsable(now)).toBe(false);
      expect(() => token.assertUsable(now)).toThrow(InvalidRefreshTokenError);
      expect(() =>
        token.rotate(now, {
          tokenHash: 'new_hash',
          expiresAt: new Date('2026-11-13T15:00:00.000Z'),
        }),
      ).toThrow(InvalidRefreshTokenError);
    });

    it('rejects a revoked token', () => {
      const token = RefreshToken.create({
        userId: 'usr_user_rev',
        tokenHash: 'hash_revoked',
        expiresAt,
      });
      token.revoke(new Date('2026-10-30T10:00:00.000Z'));

      expect(token.isRevoked()).toBe(true);
      expect(token.isUsable(now)).toBe(false);
      expect(() => token.assertUsable(now)).toThrow(InvalidRefreshTokenError);
      expect(() =>
        token.rotate(now, {
          tokenHash: 'new_hash',
          expiresAt: new Date('2026-11-13T15:00:00.000Z'),
        }),
      ).toThrow(InvalidRefreshTokenError);
    });

    it('treats the expiry instant as expired', () => {
      const exactMoment = new Date('2026-10-30T15:00:00.000Z');
      const token = RefreshToken.create({
        userId: 'usr_exact',
        tokenHash: 'hash_exact',
        expiresAt: exactMoment,
      });

      expect(token.isExpired(exactMoment)).toBe(true);
      expect(token.isUsable(exactMoment)).toBe(false);
      expect(() => token.assertUsable(exactMoment)).toThrow(InvalidRefreshTokenError);
    });

    it('revoke is idempotent and keeps the first revocation date', () => {
      const token = RefreshToken.create({
        userId: 'usr_idem',
        tokenHash: 'hash_idem',
        expiresAt,
      });

      const firstRevoke = new Date('2026-10-30T12:00:00.000Z');
      const secondRevoke = new Date('2026-10-30T16:00:00.000Z');

      token.revoke(firstRevoke);
      expect(token.revokedAt).toEqual(firstRevoke);

      token.revoke(secondRevoke);
      expect(token.revokedAt).toEqual(firstRevoke);
    });

    it('does not reveal whether the token is revoked or expired', () => {
      const expiredToken = RefreshToken.create({
        userId: 'usr_exp',
        tokenHash: 'hash_exp',
        expiresAt: new Date('2026-10-20T00:00:00.000Z'),
      });

      const revokedToken = RefreshToken.create({
        userId: 'usr_rev',
        tokenHash: 'hash_rev',
        expiresAt,
      });
      revokedToken.revoke(now);

      let expiredError: InvalidRefreshTokenError | null = null;
      try {
        expiredToken.assertUsable(now);
      } catch (err) {
        expiredError = err as InvalidRefreshTokenError;
      }

      let revokedError: InvalidRefreshTokenError | null = null;
      try {
        revokedToken.assertUsable(now);
      } catch (err) {
        revokedError = err as InvalidRefreshTokenError;
      }

      expect(expiredError).toBeInstanceOf(InvalidRefreshTokenError);
      expect(revokedError).toBeInstanceOf(InvalidRefreshTokenError);
      expect(expiredError?.message).toBe(revokedError?.message);
      expect(expiredError?.code).toBe(revokedError?.code);
      expect(expiredError?.httpStatus).toBe(401);
      expect(expiredError?.code).toBe('UNAUTHORIZED');
      expect(expiredError?.message).toBe(
        'La sesión expiró o ya no es válida. Inicia sesión nuevamente.',
      );
    });

    it('does not mutate the token when rotation is rejected', () => {
      const pastExpiresAt = new Date('2026-10-25T15:00:00.000Z');
      const token = RefreshToken.create({
        userId: 'usr_nomutate',
        tokenHash: 'hash_nomutate',
        expiresAt: pastExpiresAt,
      });

      expect(token.revokedAt).toBeNull();
      expect(() =>
        token.rotate(now, {
          tokenHash: 'attempted_hash',
          expiresAt: new Date('2026-11-13T15:00:00.000Z'),
        }),
      ).toThrow(InvalidRefreshTokenError);

      expect(token.revokedAt).toBeNull();
      expect(token.tokenHash).toBe('hash_nomutate');
    });
  });
});
