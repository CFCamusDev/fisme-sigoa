import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { AuditEvent, AuditLogger } from '../../../../shared/audit/audit-logger.js';
import { PrismaUserRepository } from './prisma-user-repository.js';
import { PrismaActivationTokenRepository } from './prisma-activation-token-repository.js';
import { RandomActivationTokenGenerator } from '../security/random-activation-token-generator.js';
import { ActivationTokenIssuerService } from '../../application/activation-token-issuer-service.js';
import { RequestPasswordRecoveryUseCase } from '../../application/request-password-recovery.js';
import type {
  PasswordResetEmailSender,
  SendPasswordResetEmailParams,
} from '../../domain/ports/password-reset-email-sender.js';
import type { DetachedTask, DetachedTaskRunner } from '../../application/detached-task-runner.js';

describe('RequestPasswordRecoveryUseCase Integration (PostgreSQL real, RS-002, RS-020, RNF-005, AGENTS §4.2, §9)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);

  const userRepo = new PrismaUserRepository(uow);
  const tokenRepo = new PrismaActivationTokenRepository(uow);
  const tokenGenerator = new RandomActivationTokenGenerator();
  const tokenIssuer = new ActivationTokenIssuerService(tokenRepo, tokenGenerator);

  const createActiveUser = async (email: string) => {
    return await prisma.user.create({
      data: {
        names: 'Juan Carlos',
        firstSurname: 'Pérez',
        email,
        status: 'ACTIVE',
      },
    });
  };

  /**
   * Runner para pruebas que recolecta promesas en vuelo y permite esperarlas sin sleeps fijos.
   */
  class TestDetachedTaskRunner implements DetachedTaskRunner {
    private readonly pending: Promise<void>[] = [];

    run(task: DetachedTask): void {
      const promise = Promise.resolve().then(task);
      this.pending.push(promise);
    }

    async waitForAll(): Promise<void> {
      await Promise.all(this.pending);
    }
  }

  it('creates activation token, records audit and dispatches password reset email for an active user', async () => {
    const user = await createActiveUser('rec-active-success@untrm.edu.pe');
    const auditedEvents: AuditEvent[] = [];
    const auditLogger: AuditLogger = {
      log: async (event: AuditEvent) => {
        auditedEvents.push(event);
      },
    };

    const sentEmails: SendPasswordResetEmailParams[] = [];
    const emailSender: PasswordResetEmailSender = {
      send: vi.fn().mockImplementation(async (params: SendPasswordResetEmailParams) => {
        sentEmails.push(params);
      }),
    };

    const detachedRunner = new TestDetachedTaskRunner();

    const useCase = new RequestPasswordRecoveryUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenIssuer: tokenIssuer,
      passwordResetEmailSender: emailSender,
      unitOfWork: uow,
      auditLogger,
      detachedTaskRunner: detachedRunner,
    });

    const result = await useCase.execute({
      email: user.email,
      ip: '190.237.10.2',
    });

    await detachedRunner.waitForAll();

    expect(result).toEqual({ status: 'RECEIVED' });

    // 1. Token creado en PostgreSQL
    const tokens = await prisma.activationToken.findMany({
      where: { userId: user.id },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.usedAt).toBeNull();
    expect(tokens[0]!.revokedAt).toBeNull();
    expect(tokens[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // 2. Correo despachado de forma asíncrona
    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]!.to).toBe(user.email);
    expect(sentEmails[0]!.names).toBe(user.names);
    expect(sentEmails[0]!.rawToken).toBeDefined();
    // La base de datos almacena el hash, nunca el token en claro
    expect(tokens[0]!.tokenHash).toBe(tokenGenerator.hash(sentEmails[0]!.rawToken));

    // 3. Auditoría en la misma transacción
    expect(auditedEvents).toHaveLength(1);
    const audit = auditedEvents[0]!;
    expect(audit.action).toBe('UPDATE');
    expect(audit.entity).toBe('User');
    expect(audit.entityId).toBe(user.id);
    expect(audit.actor).toBe(user.id);
    expect(audit.ip).toBe('190.237.10.2');
    expect(audit.after).toEqual({
      passwordRecoveryRequested: true,
      expiresAt: tokens[0]!.expiresAt.toISOString(),
    });
  });

  it('skips silently without audit or email when user does not exist', async () => {
    const auditedEvents: AuditEvent[] = [];
    const auditLogger: AuditLogger = {
      log: async (event: AuditEvent) => {
        auditedEvents.push(event);
      },
    };

    const emailSender: PasswordResetEmailSender = {
      send: vi.fn(),
    };

    const detachedRunner = new TestDetachedTaskRunner();

    const useCase = new RequestPasswordRecoveryUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenIssuer: tokenIssuer,
      passwordResetEmailSender: emailSender,
      unitOfWork: uow,
      auditLogger,
      detachedTaskRunner: detachedRunner,
    });

    const result = await useCase.execute({
      email: 'non-existent-user-12345@untrm.edu.pe',
      ip: '190.237.10.2',
    });

    await detachedRunner.waitForAll();

    expect(result).toEqual({ status: 'RECEIVED' });
    expect(emailSender.send).not.toHaveBeenCalled();
    expect(auditedEvents).toHaveLength(0);
  });

  it('skips silently without audit or email when user is not ACTIVE', async () => {
    const pendingUser = await prisma.user.create({
      data: {
        names: 'Pending',
        firstSurname: 'User',
        email: 'pending-rec-user@untrm.edu.pe',
        status: 'PENDING_ACTIVATION',
      },
    });

    const auditedEvents: AuditEvent[] = [];
    const auditLogger: AuditLogger = {
      log: async (event: AuditEvent) => {
        auditedEvents.push(event);
      },
    };

    const emailSender: PasswordResetEmailSender = {
      send: vi.fn(),
    };

    const detachedRunner = new TestDetachedTaskRunner();

    const useCase = new RequestPasswordRecoveryUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenIssuer: tokenIssuer,
      passwordResetEmailSender: emailSender,
      unitOfWork: uow,
      auditLogger,
      detachedTaskRunner: detachedRunner,
    });

    const result = await useCase.execute({
      email: pendingUser.email,
    });

    await detachedRunner.waitForAll();

    expect(result).toEqual({ status: 'RECEIVED' });
    expect(emailSender.send).not.toHaveBeenCalled();
    expect(auditedEvents).toHaveLength(0);

    const tokens = await prisma.activationToken.findMany({
      where: { userId: pendingUser.id },
    });
    expect(tokens).toHaveLength(0);
  });

  it('N concurrent requests for the same email create exactly one token and dispatch one email (RS-002, RNF-005, AGENTS §4.2, §9)', async () => {
    const user = await createActiveUser('concurrent-recovery@untrm.edu.pe');
    const auditedEvents: AuditEvent[] = [];
    const auditLogger: AuditLogger = {
      log: async (event: AuditEvent) => {
        auditedEvents.push(event);
      },
    };

    const sentEmails: SendPasswordResetEmailParams[] = [];
    const emailSender: PasswordResetEmailSender = {
      send: vi.fn().mockImplementation(async (params: SendPasswordResetEmailParams) => {
        sentEmails.push(params);
      }),
    };

    const detachedRunner = new TestDetachedTaskRunner();

    const useCase = new RequestPasswordRecoveryUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenIssuer: tokenIssuer,
      passwordResetEmailSender: emailSender,
      unitOfWork: uow,
      auditLogger,
      detachedTaskRunner: detachedRunner,
    });

    // 5 llamadas concurrentes para el mismo correo
    const results = await Promise.all([
      useCase.execute({ email: user.email, ip: '127.0.0.1' }),
      useCase.execute({ email: user.email, ip: '127.0.0.1' }),
      useCase.execute({ email: user.email, ip: '127.0.0.1' }),
      useCase.execute({ email: user.email, ip: '127.0.0.1' }),
      useCase.execute({ email: user.email, ip: '127.0.0.1' }),
    ]);

    await detachedRunner.waitForAll();

    // Todas devuelven la respuesta opaca
    for (const res of results) {
      expect(res).toEqual({ status: 'RECEIVED' });
    }

    // Exactamente 1 token emitido en base de datos
    const tokens = await prisma.activationToken.findMany({
      where: { userId: user.id },
    });
    expect(tokens).toHaveLength(1);

    // Exactamente 1 correo despachado
    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(sentEmails).toHaveLength(1);

    // Exactamente 1 evento de auditoría
    expect(auditedEvents).toHaveLength(1);
  });
});
