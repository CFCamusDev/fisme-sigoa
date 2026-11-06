import { describe, expect, it } from 'vitest';
import {
  PasswordRecoveryPolicy,
  PASSWORD_RECOVERY_COOLDOWN_SECONDS,
} from './password-recovery-policy.js';
import { User } from '../entities/user.js';

describe('PasswordRecoveryPolicy (T-005-01, T-005-12, RF-005, CA1)', () => {
  const createTestUser = (overrides?: Partial<Parameters<typeof User.restore>[0]>) => {
    return User.restore({
      id: 'usr_active_1',
      names: 'Carlos',
      firstSurname: 'Mendoza',
      secondSurname: 'Ríos',
      email: 'carlos.mendoza@untrm.edu.pe',
      dni: '87654321',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$someHash',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      ...overrides,
    });
  };

  it('issues a token for an active user without a recent token', () => {
    const user = createTestUser();
    const now = new Date('2026-11-06T10:00:00.000Z');

    const result = PasswordRecoveryPolicy.evaluate({
      user,
      latestTokenCreatedAt: null,
      now,
    });

    expect(result).toEqual({ action: 'ISSUE' });
  });

  it('skips an unknown email', () => {
    const now = new Date('2026-11-06T10:00:00.000Z');

    const result = PasswordRecoveryPolicy.evaluate({
      user: null,
      latestTokenCreatedAt: null,
      now,
    });

    expect(result).toEqual({
      action: 'SKIP',
      reason: 'USER_NOT_FOUND',
    });
  });

  it('skips inactive and pending users', () => {
    const now = new Date('2026-11-06T10:00:00.000Z');

    const inactiveUser = createTestUser({ status: 'INACTIVE' });
    const pendingUser = createTestUser({ status: 'PENDING_ACTIVATION' });

    expect(
      PasswordRecoveryPolicy.evaluate({
        user: inactiveUser,
        latestTokenCreatedAt: null,
        now,
      }),
    ).toEqual({
      action: 'SKIP',
      reason: 'USER_NOT_ACTIVE',
    });

    expect(
      PasswordRecoveryPolicy.evaluate({
        user: pendingUser,
        latestTokenCreatedAt: null,
        now,
      }),
    ).toEqual({
      action: 'SKIP',
      reason: 'USER_NOT_ACTIVE',
    });
  });

  it('skips inside the cooldown and issues at exactly 60 seconds', () => {
    const user = createTestUser();
    const tokenCreated = new Date('2026-11-06T10:00:00.000Z');

    // 59 segundos después -> dentro de enfriamiento -> SKIP COOLDOWN
    const at59s = new Date(tokenCreated.getTime() + 59 * 1000);
    const resultInsideCooldown = PasswordRecoveryPolicy.evaluate({
      user,
      latestTokenCreatedAt: tokenCreated,
      now: at59s,
    });
    expect(resultInsideCooldown).toEqual({
      action: 'SKIP',
      reason: 'COOLDOWN',
    });

    // Exactamente 60 segundos después -> enfriamiento superado -> ISSUE
    const at60s = new Date(tokenCreated.getTime() + PASSWORD_RECOVERY_COOLDOWN_SECONDS * 1000);
    const resultAt60s = PasswordRecoveryPolicy.evaluate({
      user,
      latestTokenCreatedAt: tokenCreated,
      now: at60s,
    });
    expect(resultAt60s).toEqual({ action: 'ISSUE' });

    // 61 segundos después -> ISSUE
    const at61s = new Date(tokenCreated.getTime() + 61 * 1000);
    expect(
      PasswordRecoveryPolicy.evaluate({
        user,
        latestTokenCreatedAt: tokenCreated,
        now: at61s,
      }),
    ).toEqual({ action: 'ISSUE' });
  });

  it('does not skip a locked active user', () => {
    const lockedUntil = new Date('2026-11-06T10:15:00.000Z');
    const lockedUser = createTestUser({
      status: 'ACTIVE',
      failedLoginAttempts: 5,
      lockedUntil,
    });
    const now = new Date('2026-11-06T10:00:00.000Z');

    expect(lockedUser.isLocked(now)).toBe(true);

    const result = PasswordRecoveryPolicy.evaluate({
      user: lockedUser,
      latestTokenCreatedAt: null,
      now,
    });

    expect(result).toEqual({ action: 'ISSUE' });
  });

  it('answers with the same public result for every outcome', () => {
    const publicResult = PasswordRecoveryPolicy.publicResult();
    expect(publicResult).toEqual({ status: 'RECEIVED' });

    const outcomes = [
      PasswordRecoveryPolicy.evaluate({
        user: createTestUser(),
        latestTokenCreatedAt: null,
        now: new Date(),
      }),
      PasswordRecoveryPolicy.evaluate({
        user: null,
        latestTokenCreatedAt: null,
        now: new Date(),
      }),
      PasswordRecoveryPolicy.evaluate({
        user: createTestUser({ status: 'INACTIVE' }),
        latestTokenCreatedAt: null,
        now: new Date(),
      }),
      PasswordRecoveryPolicy.evaluate({
        user: createTestUser(),
        latestTokenCreatedAt: new Date(),
        now: new Date(),
      }),
    ];

    for (const outcome of outcomes) {
      expect(outcome.action === 'ISSUE' || outcome.action === 'SKIP').toBe(true);
      expect(PasswordRecoveryPolicy.publicResult()).toEqual({ status: 'RECEIVED' });
    }
  });
});
