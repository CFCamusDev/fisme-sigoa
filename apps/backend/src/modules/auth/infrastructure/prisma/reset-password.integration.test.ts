import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { AuditEvent, AuditLogger } from '../../../../shared/audit/audit-logger.js';
import { PrismaUserRepository } from './prisma-user-repository.js';
import { PrismaActivationTokenRepository } from './prisma-activation-token-repository.js';
import { PrismaRefreshTokenRepository } from './prisma-refresh-token-repository.js';
import { Argon2PasswordHasher } from '../security/argon2-password-hasher.js';
import { RandomActivationTokenGenerator } from '../security/random-activation-token-generator.js';
import { ActivationToken } from '../../domain/entities/activation-token.js';
import { RefreshToken } from '../../domain/entities/refresh-token.js';
import { ResetPasswordUseCase } from '../../application/reset-password.js';
import { ActivateAccountUseCase } from '../../application/activate-account.js';
import { RequestPasswordRecoveryUseCase } from '../../application/request-password-recovery.js';
import { ActivationTokenIssuerService } from '../../application/activation-token-issuer-service.js';
import {
  InvalidActivationTokenError,
  InvalidPasswordResetTokenError,
} from '../../domain/errors/index.js';
import type { PasswordResetEmailSender } from '../../domain/ports/password-reset-email-sender.js';
import type { DetachedTask, DetachedTaskRunner } from '../../application/detached-task-runner.js';

describe('ResetPasswordUseCase Integration (PostgreSQL real, Argon2 real, AGENTS §4.2, §9, RS-005, RNF-017)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);

  const userRepo = new PrismaUserRepository(uow);
  const tokenRepo = new PrismaActivationTokenRepository(uow);
  const refreshTokenRepo = new PrismaRefreshTokenRepository(uow);
  const passwordHasher = new Argon2PasswordHasher();
  const tokenGenerator = new RandomActivationTokenGenerator();
  const tokenIssuer = new ActivationTokenIssuerService(tokenRepo, tokenGenerator);

  class SynchronousDetachedTaskRunner implements DetachedTaskRunner {
    run(task: DetachedTask): void {
      task().catch(() => {});
    }
  }

  const dummyEmailSender: PasswordResetEmailSender = {
    send: async () => {},
  };

  const createActiveUser = async (email: string) => {
    const initialHash = await passwordHasher.hash('InitialPassword2026*');
    return await prisma.user.create({
      data: {
        names: 'Carlos',
        firstSurname: 'Mendoza',
        email,
        status: 'ACTIVE',
        passwordHash: initialHash,
      },
    });
  };

  const createPendingUser = async (email: string) => {
    return await prisma.user.create({
      data: {
        names: 'Ana',
        firstSurname: 'Torres',
        email,
        status: 'PENDING_ACTIVATION',
      },
    });
  };

  const createTokenForUser = async (userId: string, rawToken: string) => {
    const tokenHash = tokenGenerator.hash(rawToken);
    const token = ActivationToken.create({
      userId,
      tokenHash,
    });
    await tokenRepo.add(token);
    return token;
  };

  it('updates the password, consumes token and revokes every session in the same transaction (CA2, RS-005)', async () => {
    const user = await createActiveUser('reset-e2e-success@untrm.edu.pe');
    const rawToken = 'raw-reset-token-value-12345';
    await createTokenForUser(user.id, rawToken);

    // Crear 3 refresh tokens activos
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await refreshTokenRepo.add(
      RefreshToken.create({ userId: user.id, tokenHash: 'rt-hash-1', expiresAt }),
    );
    await refreshTokenRepo.add(
      RefreshToken.create({ userId: user.id, tokenHash: 'rt-hash-2', expiresAt }),
    );
    await refreshTokenRepo.add(
      RefreshToken.create({ userId: user.id, tokenHash: 'rt-hash-3', expiresAt }),
    );

    const auditedEvents: AuditEvent[] = [];
    const auditLogger: AuditLogger = {
      log: async (event: AuditEvent) => {
        auditedEvents.push(event);
      },
    };

    const useCase = new ResetPasswordUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      refreshTokenRepository: refreshTokenRepo,
      activationTokenGenerator: tokenGenerator,
      passwordHasher,
      unitOfWork: uow,
      auditLogger,
    });

    const newPassword = 'BrandNewPassword2026!';
    const result = await useCase.execute({
      token: rawToken,
      password: newPassword,
      ip: '190.237.10.1',
    });

    expect(result).toEqual({ status: 'PASSWORD_RESET' });

    // 1. Password actualizado en PostgreSQL y verificable con Argon2
    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.passwordHash).not.toBe(user.passwordHash);
    const isValid = await passwordHasher.verify(newPassword, updatedUser.passwordHash!);
    expect(isValid).toBe(true);

    // 2. Token consumido en PostgreSQL
    const tokens = await prisma.activationToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.usedAt).not.toBeNull();

    // 3. Todas las sesiones activas revocadas
    const refreshTokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(refreshTokens).toHaveLength(3);
    for (const rt of refreshTokens) {
      expect(rt.revokedAt).not.toBeNull();
    }

    // 4. Auditoría en la misma transacción sin passwords ni tokens
    expect(auditedEvents).toHaveLength(2);
    const userAudit = auditedEvents.find((e) => e.entity === 'User');
    expect(userAudit).toBeDefined();
    expect(userAudit!.action).toBe('UPDATE');
    expect(userAudit!.entityId).toBe(user.id);
    expect(userAudit!.actor).toBe(user.id);
    expect(userAudit!.ip).toBe('190.237.10.1');
    expect(userAudit!.after).toEqual({
      passwordChanged: true,
      sessionsRevoked: 3,
    });

    const tokenAudit = auditedEvents.find((e) => e.entity === 'ActivationToken');
    expect(tokenAudit).toBeDefined();
    expect(tokenAudit!.action).toBe('STATE_CHANGE');
    expect(tokenAudit!.after).toEqual({
      usedAt: expect.any(String),
    });
  }, 30_000);

  it('exactly one of N concurrent resets wins and the others get INVALID_PASSWORD_RESET_TOKEN (AGENTS §4.2.7, §9)', async () => {
    const user = await createActiveUser('concurrent-reset@untrm.edu.pe');
    const rawToken = 'raw-token-concurrent-reset-xyz';
    await createTokenForUser(user.id, rawToken);

    const auditLogger: AuditLogger = {
      log: async () => {},
    };

    const useCase = new ResetPasswordUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      refreshTokenRepository: refreshTokenRepo,
      activationTokenGenerator: tokenGenerator,
      passwordHasher,
      unitOfWork: uow,
      auditLogger,
    });

    // 5 intentos concurrentes de restablecimiento con el mismo token
    const attempts = await Promise.allSettled([
      useCase.execute({ token: rawToken, password: 'StrongPassword1!' }),
      useCase.execute({ token: rawToken, password: 'StrongPassword2!' }),
      useCase.execute({ token: rawToken, password: 'StrongPassword3!' }),
      useCase.execute({ token: rawToken, password: 'StrongPassword4!' }),
      useCase.execute({ token: rawToken, password: 'StrongPassword5!' }),
    ]);

    const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
    const rejected = attempts.filter((a) => a.status === 'rejected');

    // Exactamente 1 gana la carrera
    expect(fulfilled).toHaveLength(1);
    expect((fulfilled[0] as PromiseFulfilledResult<{ status: string }>).value).toEqual({
      status: 'PASSWORD_RESET',
    });

    // Los otros 4 reciben InvalidPasswordResetTokenError
    expect(rejected).toHaveLength(4);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(InvalidPasswordResetTokenError);
    }
  }, 30_000);

  it('a request and a reset for the same user running together finish without deadlock (D3)', async () => {
    const user = await createActiveUser('deadlock-free-user@untrm.edu.pe');
    const rawToken = 'token-deadlock-free-initial';
    await createTokenForUser(user.id, rawToken);

    const auditLogger: AuditLogger = {
      log: async () => {},
    };

    const resetUseCase = new ResetPasswordUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      refreshTokenRepository: refreshTokenRepo,
      activationTokenGenerator: tokenGenerator,
      passwordHasher,
      unitOfWork: uow,
      auditLogger,
    });

    const requestUseCase = new RequestPasswordRecoveryUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenIssuer: tokenIssuer,
      passwordResetEmailSender: dummyEmailSender,
      unitOfWork: uow,
      auditLogger,
      detachedTaskRunner: new SynchronousDetachedTaskRunner(),
    });

    // Ejecutar simultáneamente solicitud de recuperación y restablecimiento para el mismo usuario
    const [resetRes, reqRes] = await Promise.all([
      resetUseCase.execute({ token: rawToken, password: 'NewPassword2026*' }),
      requestUseCase.execute({ email: user.email }),
    ]);

    expect(resetRes).toEqual({ status: 'PASSWORD_RESET' });
    expect(reqRes).toEqual({ status: 'RECEIVED' });
  }, 30_000);

  it('rejects cross-use between activation token and reset token in both directions (D1, D5)', async () => {
    const auditLogger: AuditLogger = {
      log: async () => {},
    };

    const resetUseCase = new ResetPasswordUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      refreshTokenRepository: refreshTokenRepo,
      activationTokenGenerator: tokenGenerator,
      passwordHasher,
      unitOfWork: uow,
      auditLogger,
    });

    const activateUseCase = new ActivateAccountUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenGenerator: tokenGenerator,
      passwordHasher,
      unitOfWork: uow,
      auditLogger,
    });

    // Caso 1: Token de usuario PENDING_ACTIVATION presentado a ResetPassword
    const pendingUser = await createPendingUser('cross-pending-user@untrm.edu.pe');
    const pendingToken = 'token-for-pending-user';
    await createTokenForUser(pendingUser.id, pendingToken);

    await expect(
      resetUseCase.execute({ token: pendingToken, password: 'StrongPassword2026*' }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);

    // Verificar que el token NO fue consumido
    const checkPendingToken = await tokenRepo.findByTokenHash(tokenGenerator.hash(pendingToken));
    expect(checkPendingToken?.usedAt).toBeNull();

    // Caso 2: Token de usuario ACTIVE (recuperación) presentado a ActivateAccount
    const activeUser = await createActiveUser('cross-active-user@untrm.edu.pe');
    const resetToken = 'token-for-active-user';
    await createTokenForUser(activeUser.id, resetToken);

    await expect(
      activateUseCase.execute({ token: resetToken, password: 'StrongPassword2026*' }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);

    // Verificar que el token NO fue consumido
    const checkResetToken = await tokenRepo.findByTokenHash(tokenGenerator.hash(resetToken));
    expect(checkResetToken?.usedAt).toBeNull();
  }, 30_000);
});
