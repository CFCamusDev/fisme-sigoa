import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ActivateAccountUseCase } from './activate-account.js';
import { User, type UserStatus } from '../domain/entities/user.js';
import { ActivationToken } from '../domain/entities/activation-token.js';
import { InvalidActivationTokenError, WeakPasswordError } from '../domain/errors/index.js';
import type {
  ActivationTokenGenerator,
  ActivationTokenRepository,
  PasswordHasher,
  UserRepository,
} from '../domain/ports/index.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';

describe('ActivateAccountUseCase (T-004-13, CA1, CA2, CA3, RF-004, RS-002, RS-015, RS-020)', () => {
  const fixedNow = new Date('2026-11-05T18:00:00.000Z');
  const clock = () => fixedNow;

  const validToken = 'raw-activation-token-32bytes-12345';
  const validTokenHash = 'hash-of-raw-activation-token-32bytes-12345';
  const strongPassword = 'StrongPassword2026*';
  const hashedStrongPassword = '$argon2id$v=19$m=65536,t=3,p=4$realHashedPassword';

  function createTestUser(id = 'usr_pending_1', status: UserStatus = 'PENDING_ACTIVATION'): User {
    return User.restore({
      id,
      names: 'Maria',
      firstSurname: 'Lopez',
      secondSurname: 'Diaz',
      email: 'maria.lopez@untrm.edu.pe',
      dni: '77889900',
      passwordHash: null,
      status,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-01T00:00:00.000Z'),
      createdBy: 'admin_1',
      updatedBy: null,
    });
  }

  function createTestToken(
    overrides: Partial<Parameters<typeof ActivationToken.restore>[0]> = {},
  ): ActivationToken {
    return ActivationToken.restore({
      id: 'act_token_1',
      userId: 'usr_pending_1',
      tokenHash: validTokenHash,
      expiresAt: new Date('2026-11-07T18:00:00.000Z'),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date('2026-11-05T10:00:00.000Z'),
      createdBy: 'admin_1',
      ...overrides,
    });
  }

  function setup() {
    const userRepository = mock<UserRepository>();
    const activationTokenRepository = mock<ActivationTokenRepository>();
    const activationTokenGenerator = mock<ActivationTokenGenerator>();
    const passwordHasher = mock<PasswordHasher>();
    const auditLogger = mock<AuditLogger>();

    const unitOfWork: UnitOfWork = {
      run: vi.fn(async (fn) => fn()),
    };

    activationTokenGenerator.hash.mockImplementation((t) => `hash-of-${t}`);
    passwordHasher.hash.mockResolvedValue(hashedStrongPassword);

    const useCase = new ActivateAccountUseCase({
      userRepository,
      activationTokenRepository,
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
      activationTokenGenerator,
      passwordHasher,
      unitOfWork,
      auditLogger,
    };
  }

  it('activates the user, consumes the token and audits both in the same transaction', async () => {
    const {
      useCase,
      userRepository,
      activationTokenRepository,
      passwordHasher,
      auditLogger,
      unitOfWork,
    } = setup();

    const pendingUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);
    userRepository.findByIdForUpdate.mockResolvedValue(pendingUser);

    const result = await useCase.execute({
      token: validToken,
      password: strongPassword,
      ip: '192.168.1.10',
    });

    expect(result).toEqual({ status: 'ACTIVE' });

    // Hashing de contraseña se ejecutó
    expect(passwordHasher.hash).toHaveBeenCalledWith(strongPassword);

    // Se ejecutó dentro de la transacción
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);

    // El usuario se guardó como ACTIVE
    expect(userRepository.saveActivation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: pendingUser.id,
        status: 'ACTIVE',
        passwordHash: hashedStrongPassword,
      }),
    );

    // El token se guardó con usedAt
    expect(activationTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: token.id,
        usedAt: fixedNow,
      }),
    );

    // Se revocaron otros tokens pendientes
    expect(activationTokenRepository.revokePendingByUserId).toHaveBeenCalledWith(
      pendingUser.id,
      fixedNow,
    );

    // Se emitieron 2 eventos de auditoría (User y ActivationToken)
    expect(auditLogger.log).toHaveBeenCalledTimes(2);
    expect(auditLogger.log).toHaveBeenNthCalledWith(1, {
      action: 'STATE_CHANGE',
      entity: 'User',
      entityId: pendingUser.id,
      actor: pendingUser.id,
      ip: '192.168.1.10',
      before: {
        status: 'PENDING_ACTIVATION',
      },
      after: {
        status: 'ACTIVE',
      },
    });

    expect(auditLogger.log).toHaveBeenNthCalledWith(2, {
      action: 'STATE_CHANGE',
      entity: 'ActivationToken',
      entityId: token.id,
      actor: pendingUser.id,
      ip: '192.168.1.10',
      before: {
        usedAt: null,
      },
      after: {
        usedAt: fixedNow.toISOString(),
      },
    });
  });

  it('rejects a weak password with the details of the policy before touching the repositories (CA3)', async () => {
    const { useCase, activationTokenRepository, passwordHasher } = setup();

    await expect(
      useCase.execute({
        token: validToken,
        password: 'weak',
      }),
    ).rejects.toBeInstanceOf(WeakPasswordError);

    // No debe interactuar con la base de datos ni con el hasher de contraseñas
    expect(activationTokenRepository.findByTokenHash).not.toHaveBeenCalled();
    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });

  it('rejects an unknown token without hashing the password (D4)', async () => {
    const { useCase, activationTokenRepository, passwordHasher, unitOfWork } = setup();

    activationTokenRepository.findByTokenHash.mockResolvedValue(null);

    await expect(
      useCase.execute({
        token: 'unknown-token-xyz',
        password: strongPassword,
      }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);

    expect(activationTokenRepository.findByTokenHash).toHaveBeenCalled();
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects an expired, used and revoked token with the same error (CA2)', async () => {
    const { useCase, activationTokenRepository, passwordHasher } = setup();

    // 1. Expirado
    const expiredToken = createTestToken({
      expiresAt: new Date(fixedNow.getTime() - 1000),
    });
    activationTokenRepository.findByTokenHash.mockResolvedValueOnce(expiredToken);

    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);

    // 2. Ya usado
    const usedToken = createTestToken({
      usedAt: new Date(fixedNow.getTime() - 1000),
    });
    activationTokenRepository.findByTokenHash.mockResolvedValueOnce(usedToken);

    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);

    // 3. Revocado
    const revokedToken = createTestToken({
      revokedAt: new Date(fixedNow.getTime() - 1000),
    });
    activationTokenRepository.findByTokenHash.mockResolvedValueOnce(revokedToken);

    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);

    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });

  it('rejects a token whose user is not pending with the same error (D5: active or inactive)', async () => {
    const { useCase, activationTokenRepository, userRepository } = setup();

    const token = createTestToken();
    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);

    // Caso A: Usuario ya activo
    const activeUser = createTestUser('usr_active', 'ACTIVE');
    userRepository.findByIdForUpdate.mockResolvedValueOnce(activeUser);

    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);

    // Caso B: Usuario inactivo
    const inactiveUser = createTestUser('usr_inactive', 'INACTIVE');
    userRepository.findByIdForUpdate.mockResolvedValueOnce(inactiveUser);

    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);

    // Caso C: Usuario no encontrado
    userRepository.findByIdForUpdate.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);
  });

  it('does not persist when the token was consumed by a concurrent request during lock acquisition', async () => {
    const { useCase, activationTokenRepository, userRepository } = setup();

    const pendingToken = createTestToken();
    // En el pre-check estaba pendiente:
    activationTokenRepository.findByTokenHash.mockResolvedValue(pendingToken);

    // Pero al tomar el bloqueo en la transacción, otro proceso ya lo consumió:
    const concurrentlyConsumedToken = createTestToken({
      usedAt: new Date(fixedNow.getTime() - 100),
    });
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(concurrentlyConsumedToken);

    await expect(
      useCase.execute({ token: validToken, password: strongPassword }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);

    expect(userRepository.saveActivation).not.toHaveBeenCalled();
  });

  it('revokes the other pending tokens of the user upon activation', async () => {
    const { useCase, activationTokenRepository, userRepository } = setup();

    const pendingUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);
    userRepository.findByIdForUpdate.mockResolvedValue(pendingUser);

    await useCase.execute({ token: validToken, password: strongPassword });

    expect(activationTokenRepository.revokePendingByUserId).toHaveBeenCalledWith(
      pendingUser.id,
      fixedNow,
    );
  });

  it('never writes the token, the password or the hash to the audit log (RS-020, RNF-005)', async () => {
    const { useCase, activationTokenRepository, userRepository, auditLogger } = setup();

    const pendingUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);
    userRepository.findByIdForUpdate.mockResolvedValue(pendingUser);

    await useCase.execute({ token: validToken, password: strongPassword });

    for (const call of auditLogger.log.mock.calls) {
      const event = call[0];
      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain(validToken);
      expect(serialized).not.toContain(validTokenHash);
      expect(serialized).not.toContain(strongPassword);
      expect(serialized).not.toContain(hashedStrongPassword);
    }
  });

  it('propagates an audit failure so the transaction rolls back', async () => {
    const { useCase, activationTokenRepository, userRepository, auditLogger } = setup();

    const pendingUser = createTestUser();
    const token = createTestToken();

    activationTokenRepository.findByTokenHash.mockResolvedValue(token);
    activationTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);
    userRepository.findByIdForUpdate.mockResolvedValue(pendingUser);

    auditLogger.log.mockRejectedValue(new Error('Audit write failure'));

    await expect(useCase.execute({ token: validToken, password: strongPassword })).rejects.toThrow(
      'Audit write failure',
    );
  });
});
