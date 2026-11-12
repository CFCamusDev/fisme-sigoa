import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ResetPasswordUseCase } from './reset-password.js';
import { User, type UserStatus } from '../domain/entities/user.js';
import { ActivationToken } from '../domain/entities/activation-token.js';
import {
  InvalidActivationTokenError,
  InvalidPasswordResetTokenError,
  UserNotActiveError,
  WeakPasswordError,
} from '../domain/errors/index.js';
import type {
  ActivationTokenGenerator,
  ActivationTokenRepository,
  PasswordHasher,
  RefreshTokenRepository,
  UserRepository,
} from '../domain/ports/index.js';
import type { AuditEvent, AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';

describe('ResetPasswordUseCase Unit Tests (T-005-14, RF-005, RS-002, RS-005, RS-020, RNF-017)', () => {
  const fixedNow = new Date('2026-11-06T15:00:00.000Z');
  const clock = () => fixedNow;

  const validToken = 'raw-reset-token-32bytes-12345';
  const validTokenHash = 'hash-of-raw-reset-token-32bytes-12345';
  const strongPassword = 'StrongPassword2026*';
  const hashedStrongPassword = '$argon2id$v=19$m=65536,t=3,p=4$realHashedPassword';

  function createTestUser(id = 'usr_active_1', status: UserStatus = 'ACTIVE'): User {
    return User.restore({
      id,
      names: 'Carlos',
      firstSurname: 'Mendoza',
      email: 'carlos.mendoza@untrm.edu.pe',
      status,
      failedLoginAttempts: 0,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$oldPasswordHash',
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    });
  }

  function createTestToken(
    overrides: Partial<Parameters<typeof ActivationToken.restore>[0]> = {},
  ): ActivationToken {
    return ActivationToken.restore({
      id: 'token_reset_1',
      userId: 'usr_active_1',
      tokenHash: validTokenHash,
      expiresAt: new Date('2026-11-08T15:00:00.000Z'),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date('2026-11-06T10:00:00.000Z'),
      createdBy: 'usr_active_1',
      ...overrides,
    });
  }

  function setup() {
    const userRepository = mock<UserRepository>();
    const activationTokenRepository = mock<ActivationTokenRepository>();
    const refreshTokenRepository = mock<RefreshTokenRepository>();
    const activationTokenGenerator = mock<ActivationTokenGenerator>();
    const passwordHasher = mock<PasswordHasher>();
    const auditLogger = mock<AuditLogger>();

    const unitOfWork: UnitOfWork = {
      run: vi.fn(async (fn) => fn()),
    };

    activationTokenGenerator.hash.mockImplementation((t) => `hash-of-${t}`);
    passwordHasher.hash.mockResolvedValue(hashedStrongPassword);
    refreshTokenRepository.revokeAllForUser.mockResolvedValue(2);

    const useCase = new ResetPasswordUseCase({
      userRepository,
      activationTokenRepository,
      refreshTokenRepository,
      activationTokenGenerator,
      passwordHasher,
      unitOfWork,
      auditLogger,
      clock,
    });

    return {
      useCase,
      userRepository,
      activationTokenRepository,
      refreshTokenRepository,
      activationTokenGenerator,
      passwordHasher,
      unitOfWork,
      auditLogger,
    };
  }

  it('updates the password, consumes token and revokes every session in the same transaction (CA2)', async () => {
    const {
      useCase,
      userRepository,
      activationTokenRepository,
      refreshTokenRepository,
      passwordHasher,
      auditLogger,
      unitOfWork,
    } = setup();

    const activeUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    userRepository.findById.mockResolvedValue(activeUser);
    userRepository.findByIdForUpdate.mockResolvedValue(activeUser);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);

    const result = await useCase.execute({
      token: validToken,
      password: strongPassword,
      ip: '190.237.10.1',
    });

    expect(result).toEqual({ status: 'PASSWORD_RESET' });

    // Hashing fuera de la transacción
    expect(passwordHasher.hash).toHaveBeenCalledWith(strongPassword);

    // Transacción ejecutada
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);

    // Persistencia condicional y revocación
    expect(userRepository.savePasswordReset).toHaveBeenCalledWith(activeUser);
    expect(activationTokenRepository.save).toHaveBeenCalledWith(token);
    expect(activationTokenRepository.revokePendingByUserId).toHaveBeenCalledWith(
      activeUser.id,
      fixedNow,
    );
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(activeUser.id, fixedNow);

    // Auditoría registrada
    expect(auditLogger.log).toHaveBeenCalledTimes(2);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        entity: 'User',
        entityId: activeUser.id,
        after: {
          passwordChanged: true,
          sessionsRevoked: 2,
        },
      }),
    );
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATE_CHANGE',
        entity: 'ActivationToken',
        entityId: token.id,
      }),
    );
  });

  it('rejects a weak password with the policy details before touching the repositories', async () => {
    const { useCase, activationTokenRepository, userRepository } = setup();

    await expect(
      useCase.execute({
        token: validToken,
        password: 'weak',
      }),
    ).rejects.toBeInstanceOf(WeakPasswordError);

    expect(activationTokenRepository.findByTokenHash).not.toHaveBeenCalled();
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects unknown, expired, used and revoked tokens with InvalidPasswordResetTokenError without hashing password (D8)', async () => {
    const { useCase, activationTokenRepository, userRepository, passwordHasher } = setup();

    // 1. Token desconocido
    activationTokenRepository.findByTokenHash.mockResolvedValueOnce(null);
    await expect(
      useCase.execute({ token: 'unknown-token', password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);

    // 2. Token vencido
    const expiredToken = createTestToken({
      expiresAt: new Date(fixedNow.getTime() - 1000),
    });
    activationTokenRepository.findByTokenHash.mockResolvedValueOnce(expiredToken);
    await expect(
      useCase.execute({ token: 'expired-token', password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);

    // 3. Token ya usado
    const usedToken = createTestToken({
      usedAt: new Date(fixedNow.getTime() - 60_000),
    });
    activationTokenRepository.findByTokenHash.mockResolvedValueOnce(usedToken);
    await expect(
      useCase.execute({ token: 'used-token', password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);

    // 4. Token revocado
    const revokedToken = createTestToken({
      revokedAt: new Date(fixedNow.getTime() - 60_000),
    });
    activationTokenRepository.findByTokenHash.mockResolvedValueOnce(revokedToken);
    await expect(
      useCase.execute({ token: 'revoked-token', password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);

    // No se calculó argon2 en ninguno de los casos
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(userRepository.findByIdForUpdate).not.toHaveBeenCalled();
  });

  it('rejects a token whose user is pending or inactive with InvalidPasswordResetTokenError without hashing password', async () => {
    const { useCase, activationTokenRepository, userRepository, passwordHasher } = setup();
    const token = createTestToken();
    activationTokenRepository.findByTokenHash.mockResolvedValue(token);

    // 1. Usuario inexistente
    userRepository.findById.mockResolvedValueOnce(null);
    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);

    // 2. Usuario en PENDING_ACTIVATION
    const pendingUser = createTestUser('usr_pending_1', 'PENDING_ACTIVATION');
    userRepository.findById.mockResolvedValueOnce(pendingUser);
    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);

    // 3. Usuario en INACTIVE
    const inactiveUser = createTestUser('usr_inactive_1', 'INACTIVE');
    userRepository.findById.mockResolvedValueOnce(inactiveUser);
    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);

    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });

  it('does not persist when the token was consumed by a concurrent request', async () => {
    const { useCase, activationTokenRepository, userRepository } = setup();
    const activeUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    userRepository.findById.mockResolvedValue(activeUser);
    userRepository.findByIdForUpdate.mockResolvedValue(activeUser);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);

    // save() del repositorio rechaza porque otra transacción consumió el token
    activationTokenRepository.save.mockRejectedValueOnce(new InvalidActivationTokenError());

    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
  });

  it('does not persist when the user was concurrently modified to non-active', async () => {
    const { useCase, activationTokenRepository, userRepository } = setup();
    const activeUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    userRepository.findById.mockResolvedValue(activeUser);
    userRepository.findByIdForUpdate.mockResolvedValue(activeUser);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);

    userRepository.savePasswordReset.mockRejectedValueOnce(new UserNotActiveError());

    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
  });

  it('never writes the password, the token or hashes to the audit log', async () => {
    const { useCase, activationTokenRepository, userRepository, auditLogger } = setup();
    const activeUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    userRepository.findById.mockResolvedValue(activeUser);
    userRepository.findByIdForUpdate.mockResolvedValue(activeUser);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);

    const loggedEvents: AuditEvent[] = [];
    auditLogger.log.mockImplementation(async (event) => {
      loggedEvents.push(event);
    });

    await useCase.execute({
      token: validToken,
      password: strongPassword,
      ip: '190.237.10.1',
    });

    for (const event of loggedEvents) {
      const serialized = JSON.stringify(event).toLowerCase();
      expect(serialized).not.toContain(strongPassword.toLowerCase());
      expect(serialized).not.toContain(validToken.toLowerCase());
      expect(serialized).not.toContain(hashedStrongPassword.toLowerCase());
      expect(serialized).not.toContain(validTokenHash.toLowerCase());
    }
  });

  it('propagates an audit failure so the transaction rolls back', async () => {
    const { useCase, activationTokenRepository, userRepository, auditLogger } = setup();
    const activeUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    userRepository.findById.mockResolvedValue(activeUser);
    userRepository.findByIdForUpdate.mockResolvedValue(activeUser);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);

    auditLogger.log.mockRejectedValueOnce(new Error('Audit DB connectivity issue'));

    await expect(useCase.execute({ token: validToken, password: strongPassword })).rejects.toThrow(
      'Audit DB connectivity issue',
    );
  });

  it('locks the user before the token (D3) to avoid deadlock', async () => {
    const { useCase, activationTokenRepository, userRepository } = setup();
    const activeUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    userRepository.findById.mockResolvedValue(activeUser);

    const callOrder: string[] = [];

    userRepository.findByIdForUpdate.mockImplementation(async () => {
      callOrder.push('userLock');
      return activeUser;
    });

    activationTokenRepository.findByTokenHashForUpdate.mockImplementation(async () => {
      callOrder.push('tokenLock');
      return token;
    });

    await useCase.execute({
      token: validToken,
      password: strongPassword,
    });

    expect(callOrder).toEqual(['userLock', 'tokenLock']);
  });
});
