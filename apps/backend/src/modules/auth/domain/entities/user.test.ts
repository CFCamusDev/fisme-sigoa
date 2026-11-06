import { describe, expect, it } from 'vitest';
import { User } from './user.js';
import { LoginPolicy } from '../value-objects/login-policy.js';
import {
  AccountLockedError,
  AccountInactiveError,
  AccountPendingActivationError,
  UserNotPendingActivationError,
} from '../errors/index.js';

describe('User Entity', () => {
  const defaultPolicy = new LoginPolicy(); // Prueba valores por defecto (5 intentos, 15 min)

  const createActiveUser = (overrides?: Partial<Parameters<typeof User.restore>[0]>) => {
    return User.restore({
      id: 'usr_123',
      names: 'Juan Carlos',
      firstSurname: 'Pérez',
      secondSurname: 'Gómez',
      email: 'JUAN.PEREZ@UNTRM.EDU.PE',
      dni: '12345678',
      passwordHash: 'hash123',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdBy: 'admin_1',
      updatedBy: 'admin_2',
      ...overrides,
    });
  };

  it('restores properties correctly with normalized lowercase email and provides getters', () => {
    const user = createActiveUser();
    expect(user.id).toBe('usr_123');
    expect(user.names).toBe('Juan Carlos');
    expect(user.firstSurname).toBe('Pérez');
    expect(user.secondSurname).toBe('Gómez');
    expect(user.email).toBe('juan.perez@untrm.edu.pe');
    expect(user.dni).toBe('12345678');
    expect(user.passwordHash).toBe('hash123');
    expect(user.status).toBe('ACTIVE');
    expect(user.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(user.updatedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(user.createdBy).toBe('admin_1');
    expect(user.updatedBy).toBe('admin_2');
    expect(user.lockRemainingSeconds(new Date())).toBe(0);
  });

  it('locks the account after the maximum failed attempts (CA3)', () => {
    const user = createActiveUser({ failedLoginAttempts: 4 });
    const now = new Date('2026-10-30T10:00:00.000Z');

    user.registerFailedLogin(now, defaultPolicy);

    expect(user.failedLoginAttempts).toBe(5);
    expect(user.lockedUntil).toEqual(new Date('2026-10-30T10:15:00.000Z'));
    expect(user.isLocked(now)).toBe(true);

    expect(() => user.assertCanAuthenticate(now)).toThrow(AccountLockedError);
  });

  it('keeps the lock without extending it while locked (CA3)', () => {
    const now = new Date('2026-10-30T10:05:00.000Z');
    const originalLockTime = new Date('2026-10-30T10:15:00.000Z');
    const user = createActiveUser({
      failedLoginAttempts: 5,
      lockedUntil: originalLockTime,
    });

    user.registerFailedLogin(now, defaultPolicy);

    expect(user.lockedUntil).toEqual(originalLockTime);
    expect(user.failedLoginAttempts).toBe(5);
  });

  it('restarts the counter after the lock expires (CA3)', () => {
    const expiredLockTime = new Date('2026-10-30T10:15:00.000Z');
    const user = createActiveUser({
      failedLoginAttempts: 5,
      lockedUntil: expiredLockTime,
    });
    const now = new Date('2026-10-30T10:16:00.000Z');

    expect(user.isLocked(now)).toBe(false);

    user.registerFailedLogin(now, defaultPolicy);

    expect(user.failedLoginAttempts).toBe(1);
    expect(user.lockedUntil).toBeNull();
  });

  it('reports the remaining lock seconds rounded up (CA3)', () => {
    const lockUntil = new Date('2026-10-30T10:15:00.000Z');
    const user = createActiveUser({
      failedLoginAttempts: 5,
      lockedUntil: lockUntil,
    });
    const now = new Date('2026-10-30T10:14:15.500Z'); // 44.5 segundos restantes

    expect(user.lockRemainingSeconds(now)).toBe(45);
  });

  it('formats AccountLockedError message correctly for singular and plural minutes', () => {
    const errSingular = new AccountLockedError(59);
    expect(errSingular.message).toContain('1 minuto.');
    expect(errSingular.retryAfterSeconds).toBe(59);

    const errPlural = new AccountLockedError(120);
    expect(errPlural.message).toContain('2 minutos.');
  });

  it('resets counter and lock on successful login (CA1)', () => {
    const user = createActiveUser({
      failedLoginAttempts: 4,
      lockedUntil: null,
    });
    const now = new Date('2026-10-30T10:00:00.000Z');

    user.registerSuccessfulLogin(now);

    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.lastLoginAt).toEqual(now);
  });

  it('blocks inactive and pending activation users (CA4)', () => {
    const now = new Date('2026-10-30T10:00:00.000Z');

    const pendingUser = createActiveUser({ status: 'PENDING_ACTIVATION' });
    expect(() => pendingUser.assertCanAuthenticate(now)).toThrow(AccountPendingActivationError);

    const inactiveUser = createActiveUser({ status: 'INACTIVE' });
    expect(() => inactiveUser.assertCanAuthenticate(now)).toThrow(AccountInactiveError);
  });

  it('activates a pending user and stores the password hash (RS-015)', () => {
    const user = createActiveUser({
      status: 'PENDING_ACTIVATION',
      passwordHash: null,
    });
    const now = new Date('2026-11-05T16:00:00.000Z');
    const newHash = '$argon2id$v=19$m=65536,t=3,p=4$someSecretHash';

    user.activate(newHash, now);

    expect(user.status).toBe('ACTIVE');
    expect(user.passwordHash).toBe(newHash);
    expect(user.updatedAt).toEqual(now);
  });

  it('rejects activating an active or inactive user with UserNotPendingActivationError', () => {
    const activeUser = createActiveUser({ status: 'ACTIVE' });
    const inactiveUser = createActiveUser({ status: 'INACTIVE' });
    const newHash = 'hash-xyz';

    expect(() => activeUser.activate(newHash)).toThrow(UserNotPendingActivationError);
    expect(() => inactiveUser.activate(newHash)).toThrow(UserNotPendingActivationError);
  });

  it('activation keeps failed attempts and lock untouched', () => {
    const lockUntil = new Date('2026-11-05T16:15:00.000Z');
    const user = createActiveUser({
      status: 'PENDING_ACTIVATION',
      failedLoginAttempts: 3,
      lockedUntil: lockUntil,
    });
    const now = new Date('2026-11-05T16:00:00.000Z');

    user.activate('new-password-hash', now);

    expect(user.failedLoginAttempts).toBe(3);
    expect(user.lockedUntil).toEqual(lockUntil);
  });
});
