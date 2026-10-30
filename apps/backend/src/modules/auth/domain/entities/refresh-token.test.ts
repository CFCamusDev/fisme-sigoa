import { describe, expect, it } from 'vitest';
import { RefreshToken } from './refresh-token.js';

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
});
