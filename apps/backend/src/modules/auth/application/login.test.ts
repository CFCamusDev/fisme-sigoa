import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { LoginUseCase } from './login.js';
import { User } from '../domain/entities/user.js';
import { LoginPolicy } from '../domain/value-objects/login-policy.js';
import {
  AccountInactiveError,
  AccountLockedError,
  AccountPendingActivationError,
} from '../domain/errors/index.js';
import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import type {
  AccessTokenSigner,
  PasswordHasher,
  RefreshTokenGenerator,
  RefreshTokenRepository,
  UserRepository,
} from '../domain/ports/index.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';

describe('LoginUseCase (T-001-09, T-001-19, CA1, CA2, CA3, CA4)', () => {
  const policy = new LoginPolicy({ maxFailedAttempts: 5, lockoutMinutes: 15 });
  const fixedNow = new Date('2026-10-30T10:00:00.000Z');
  const clock = () => fixedNow;

  function createActiveUser(overrides: Partial<Parameters<typeof User.restore>[0]> = {}): User {
    return User.restore({
      id: 'usr_active_123',
      names: 'Juan',
      firstSurname: 'Pérez',
      secondSurname: 'Gómez',
      email: 'juan.perez@untrm.edu.pe',
      dni: '12345678',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      ...overrides,
    });
  }

  function setup() {
    const userRepository = mock<UserRepository>();
    const refreshTokenRepository = mock<RefreshTokenRepository>();
    const passwordHasher = mock<PasswordHasher>();
    const accessTokenSigner = mock<AccessTokenSigner>();
    const refreshTokenGenerator = mock<RefreshTokenGenerator>();
    const auditLogger = mock<AuditLogger>();

    // UnitOfWork passthrough simple que ejecuta la función
    const unitOfWork: UnitOfWork = {
      run: vi.fn(async (fn) => fn()),
    };

    const useCase = new LoginUseCase({
      userRepository,
      refreshTokenRepository,
      passwordHasher,
      accessTokenSigner,
      refreshTokenGenerator,
      unitOfWork,
      auditLogger,
      loginPolicy: policy,
      clock,
    });

    return {
      useCase,
      userRepository,
      refreshTokenRepository,
      passwordHasher,
      accessTokenSigner,
      refreshTokenGenerator,
      unitOfWork,
      auditLogger,
    };
  }

  it('issues access and refresh tokens for an active user with valid credentials (CA1)', async () => {
    const {
      useCase,
      userRepository,
      passwordHasher,
      accessTokenSigner,
      refreshTokenGenerator,
      refreshTokenRepository,
      auditLogger,
    } = setup();

    const user = createActiveUser({ failedLoginAttempts: 2 });
    userRepository.findByEmail.mockResolvedValue(user);
    userRepository.findByEmailForUpdate.mockResolvedValue(user);
    passwordHasher.verify.mockResolvedValue(true);

    const accessExpiresAt = new Date('2026-10-30T10:15:00.000Z');
    accessTokenSigner.sign.mockResolvedValue({
      token: 'access-jwt-token',
      expiresAt: accessExpiresAt,
    });

    const refreshExpiresAt = new Date('2026-11-06T10:00:00.000Z');
    refreshTokenGenerator.generate.mockReturnValue({
      token: 'raw-refresh-token',
      tokenHash: 'sha256-of-refresh-token',
      expiresAt: refreshExpiresAt,
    });

    const result = await useCase.execute({
      email: '  JUAN.PEREZ@UNTRM.EDU.PE  ',
      password: 'CorrectPassword123!',
      ip: '190.12.34.56',
    });

    expect(result).toEqual({
      accessToken: 'access-jwt-token',
      accessTokenExpiresAt: accessExpiresAt.toISOString(),
      refreshToken: 'raw-refresh-token',
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      user: {
        id: 'usr_active_123',
        names: 'Juan',
        firstSurname: 'Pérez',
        secondSurname: 'Gómez',
        email: 'juan.perez@untrm.edu.pe',
      },
    });

    // Contador de intentos reseteado y guardado
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lastLoginAt).toEqual(fixedNow);
    expect(userRepository.save).toHaveBeenCalledWith(user);

    // Refresh token guardado con solo el hash y la IP
    expect(refreshTokenRepository.add).toHaveBeenCalledTimes(1);
    const addedToken = refreshTokenRepository.add.mock.calls[0]![0];
    expect(addedToken.tokenHash).toBe('sha256-of-refresh-token');
    expect(addedToken.createdByIp).toBe('190.12.34.56');

    // Auditoría exitosa
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_SUCCESS',
        entity: 'User',
        entityId: 'usr_active_123',
        actor: 'usr_active_123',
        ip: '190.12.34.56',
      }),
    );
  });

  it('returns the same error for unknown email and wrong password (CA2)', async () => {
    const { useCase, userRepository, passwordHasher, auditLogger } = setup();

    // 1. Correo inexistente
    userRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.verifyDummy.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'desconocido@untrm.edu.pe',
        password: 'any-password',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow(new UnauthorizedError('Correo o contraseña incorrectos'));

    expect(passwordHasher.verifyDummy).toHaveBeenCalledWith('any-password');
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILURE',
        entity: 'User',
        entityId: 'desconocido@untrm.edu.pe',
        actor: 'desconocido@untrm.edu.pe',
      }),
    );

    // 2. Usuario existente con contraseña incorrecta
    const user = createActiveUser({ failedLoginAttempts: 1 });
    userRepository.findByEmail.mockResolvedValue(user);
    userRepository.findByEmailForUpdate.mockResolvedValue(user);
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'juan.perez@untrm.edu.pe',
        password: 'WrongPassword!',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow(new UnauthorizedError('Correo o contraseña incorrectos'));

    expect(user.failedLoginAttempts).toBe(2);
    expect(userRepository.save).toHaveBeenCalledWith(user);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILURE',
        entity: 'User',
        entityId: 'usr_active_123',
        actor: 'usr_active_123',
      }),
    );
  });

  it('rejects a locked account and reports the remaining time without verifying password (CA3)', async () => {
    const { useCase, userRepository, passwordHasher, auditLogger } = setup();

    const lockedUntil = new Date('2026-10-30T10:10:00.000Z'); // 10 minutos restantes
    const user = createActiveUser({
      failedLoginAttempts: 5,
      lockedUntil,
    });

    userRepository.findByEmail.mockResolvedValue(user);
    userRepository.findByEmailForUpdate.mockResolvedValue(user);

    await expect(
      useCase.execute({
        email: 'juan.perez@untrm.edu.pe',
        password: 'AnyPassword!',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow(AccountLockedError);

    // No debe verificar la contraseña de una cuenta bloqueada
    expect(passwordHasher.verify).not.toHaveBeenCalled();
    // No debe incrementar el contador de intentos
    expect(user.failedLoginAttempts).toBe(5);
    expect(userRepository.save).not.toHaveBeenCalled();

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILURE',
        after: expect.objectContaining({
          reason: 'ACCOUNT_LOCKED',
        }),
      }),
    );
  });

  it('locks the account on the fifth consecutive failure (CA3)', async () => {
    const { useCase, userRepository, passwordHasher, auditLogger } = setup();

    const user = createActiveUser({ failedLoginAttempts: 4 });
    userRepository.findByEmail.mockResolvedValue(user);
    userRepository.findByEmailForUpdate.mockResolvedValue(user);
    passwordHasher.verify.mockResolvedValue(false);

    // El 5to fallo todavía devuelve el error genérico
    await expect(
      useCase.execute({
        email: 'juan.perez@untrm.edu.pe',
        password: 'WrongPassword!',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow(new UnauthorizedError('Correo o contraseña incorrectos'));

    expect(user.failedLoginAttempts).toBe(5);
    expect(user.lockedUntil).toEqual(new Date('2026-10-30T10:15:00.000Z'));
    expect(userRepository.save).toHaveBeenCalledWith(user);

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILURE',
        after: expect.objectContaining({
          status: 'LOCKED_NOW',
          failedLoginAttempts: 5,
        }),
      }),
    );
  });

  it('rejects inactive and pending activation users with specific domain errors (CA4)', async () => {
    const { useCase, userRepository, passwordHasher, auditLogger } = setup();

    // 1. Usuario Inactivo
    const inactiveUser = createActiveUser({ status: 'INACTIVE' });
    userRepository.findByEmail.mockResolvedValue(inactiveUser);
    userRepository.findByEmailForUpdate.mockResolvedValue(inactiveUser);

    await expect(
      useCase.execute({
        email: 'inactivo@untrm.edu.pe',
        password: 'Password123!',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow(AccountInactiveError);

    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILURE',
        after: expect.objectContaining({
          reason: 'ACCOUNT_INACTIVE',
        }),
      }),
    );

    // 2. Usuario Pendiente de Activación
    const pendingUser = createActiveUser({ status: 'PENDING_ACTIVATION' });
    userRepository.findByEmail.mockResolvedValue(pendingUser);
    userRepository.findByEmailForUpdate.mockResolvedValue(pendingUser);

    await expect(
      useCase.execute({
        email: 'pendiente@untrm.edu.pe',
        password: 'Password123!',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow(AccountPendingActivationError);

    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILURE',
        after: expect.objectContaining({
          reason: 'ACCOUNT_PENDING_ACTIVATION',
        }),
      }),
    );
  });

  it('rejects a correct password when the account got locked concurrently', async () => {
    const { useCase, userRepository, passwordHasher } = setup();

    // En fase 1 parece activo
    const userPhase1 = createActiveUser({ failedLoginAttempts: 4 });
    userRepository.findByEmail.mockResolvedValue(userPhase1);
    passwordHasher.verify.mockResolvedValue(true);

    // Pero en fase 2 (bajo bloqueo de fila), otra petición lo bloqueó
    const userPhase2 = createActiveUser({
      failedLoginAttempts: 5,
      lockedUntil: new Date('2026-10-30T10:15:00.000Z'),
    });
    userRepository.findByEmailForUpdate.mockResolvedValue(userPhase2);

    await expect(
      useCase.execute({
        email: 'juan.perez@untrm.edu.pe',
        password: 'CorrectPassword!',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow(AccountLockedError);
  });

  it('rolls back and issues no tokens when the audit fails (fail closed)', async () => {
    const {
      userRepository,
      passwordHasher,
      accessTokenSigner,
      refreshTokenGenerator,
      refreshTokenRepository,
      auditLogger,
    } = setup();

    // UnitOfWork que simula que si fn() arroja error, no se emite nada
    const failingUnitOfWork: UnitOfWork = {
      run: vi.fn(async (fn) => fn()),
    };

    auditLogger.log.mockRejectedValue(new Error('Database disk full in audit'));

    const useCase = new LoginUseCase({
      userRepository,
      refreshTokenRepository,
      passwordHasher,
      accessTokenSigner,
      refreshTokenGenerator,
      unitOfWork: failingUnitOfWork,
      auditLogger,
      loginPolicy: policy,
      clock,
    });

    const user = createActiveUser();
    userRepository.findByEmail.mockResolvedValue(user);
    userRepository.findByEmailForUpdate.mockResolvedValue(user);
    passwordHasher.verify.mockResolvedValue(true);

    accessTokenSigner.sign.mockResolvedValue({
      token: 'jwt.token',
      expiresAt: new Date(),
    });
    refreshTokenGenerator.generate.mockReturnValue({
      token: 'raw.refresh',
      tokenHash: 'hash',
      expiresAt: new Date(),
    });

    await expect(
      useCase.execute({
        email: 'juan.perez@untrm.edu.pe',
        password: 'CorrectPassword!',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow('Database disk full in audit');
  });

  it('never writes the password or tokens into the audit event', async () => {
    const {
      useCase,
      userRepository,
      passwordHasher,
      accessTokenSigner,
      refreshTokenGenerator,
      auditLogger,
    } = setup();

    const user = createActiveUser();
    userRepository.findByEmail.mockResolvedValue(user);
    userRepository.findByEmailForUpdate.mockResolvedValue(user);
    passwordHasher.verify.mockResolvedValue(true);

    accessTokenSigner.sign.mockResolvedValue({
      token: 'jwt.token.secret',
      expiresAt: new Date(),
    });
    refreshTokenGenerator.generate.mockReturnValue({
      token: 'raw.refresh.secret',
      tokenHash: 'hash',
      expiresAt: new Date(),
    });

    await useCase.execute({
      email: 'juan.perez@untrm.edu.pe',
      password: 'SuperSecretPassword!',
      ip: '190.12.34.56',
    });

    const callArgs = auditLogger.log.mock.calls[0]![0];
    const stringified = JSON.stringify(callArgs);

    expect(stringified).not.toContain('SuperSecretPassword!');
    expect(stringified).not.toContain('jwt.token.secret');
    expect(stringified).not.toContain('raw.refresh.secret');
  });

  it('uses the lockout policy and records it as a snapshot in the audit event', async () => {
    const { useCase, userRepository, passwordHasher, auditLogger } = setup();

    userRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.verifyDummy.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'desconocido@untrm.edu.pe',
        password: 'password',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow();

    const auditCall = auditLogger.log.mock.calls[0]![0];
    expect(auditCall.after).toEqual(
      expect.objectContaining({
        policy: {
          maxFailedAttempts: 5,
          lockoutMinutes: 15,
        },
      }),
    );
  });

  it('runs dummy verify and rejects when an active user has no password hash set', async () => {
    const { useCase, userRepository, passwordHasher } = setup();

    const userWithoutHash = createActiveUser({ passwordHash: null });
    userRepository.findByEmail.mockResolvedValue(userWithoutHash);
    userRepository.findByEmailForUpdate.mockResolvedValue(userWithoutHash);
    passwordHasher.verifyDummy.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'juan.perez@untrm.edu.pe',
        password: 'Password123!',
        ip: '190.12.34.56',
      }),
    ).rejects.toThrow(new UnauthorizedError('Correo o contraseña incorrectos'));

    expect(passwordHasher.verifyDummy).toHaveBeenCalledWith('Password123!');
  });
});
