import { describe, expect, it, vi } from 'vitest';
import type { AuditEvent, AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { User } from '../domain/entities/user.js';
import type {
  ActivationTokenRepository,
  PasswordResetEmailSender,
  SendPasswordResetEmailParams,
  UserRepository,
} from '../domain/ports/index.js';
import type { ActivationTokenIssuerService } from './activation-token-issuer-service.js';
import { RequestPasswordRecoveryUseCase } from './request-password-recovery.js';
import type { DetachedTask, DetachedTaskRunner } from './detached-task-runner.js';

describe('RequestPasswordRecoveryUseCase Unit Tests (T-005-13, RF-005, RS-002, RS-020, RNF-005)', () => {
  const activeUser = User.restore({
    id: 'user-active-1',
    email: 'carlos.docente@untrm.edu.pe',
    names: 'Carlos',
    firstSurname: 'Mendoza',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
  });

  const inactiveUser = User.restore({
    id: 'user-inactive-1',
    email: 'inactivo@untrm.edu.pe',
    names: 'Inactivo',
    firstSurname: 'User',
    status: 'INACTIVE',
    failedLoginAttempts: 0,
  });

  const pendingUser = User.restore({
    id: 'user-pending-1',
    email: 'pendiente@untrm.edu.pe',
    names: 'Pendiente',
    firstSurname: 'User',
    status: 'PENDING_ACTIVATION',
    failedLoginAttempts: 0,
  });

  const synchronousUnitOfWork: UnitOfWork = {
    run: async <T>(work: () => Promise<T>): Promise<T> => work(),
  };

  class DirectDetachedTaskRunner implements DetachedTaskRunner {
    public executed = 0;
    public errors: unknown[] = [];

    run(task: DetachedTask): void {
      this.executed++;
      task().catch((err: unknown) => {
        this.errors.push(err);
      });
    }
  }

  it('issues a token, audits UPDATE on User and sends email for an ACTIVE user', async () => {
    const mockUserRepo: UserRepository = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      findByEmail: vi.fn(),
      findByEmailForUpdate: vi.fn().mockResolvedValue(activeUser),
      save: vi.fn(),
      saveActivation: vi.fn(),
      savePasswordReset: vi.fn(),
    };

    const mockTokenRepo: ActivationTokenRepository = {
      add: vi.fn(),
      findByTokenHash: vi.fn(),
      findByTokenHashForUpdate: vi.fn(),
      save: vi.fn(),
      revokePendingByUserId: vi.fn(),
      findLatestCreatedAtByUserId: vi.fn().mockResolvedValue(null),
    };

    const now = new Date('2026-11-06T12:00:00.000Z');
    const expiresAt = new Date('2026-11-08T12:00:00.000Z');

    const mockTokenIssuer = {
      issue: vi.fn().mockResolvedValue({
        token: 'raw-recovery-token-12345',
        expiresAt,
      }),
    } as unknown as ActivationTokenIssuerService;

    const sentEmails: SendPasswordResetEmailParams[] = [];
    const mockEmailSender: PasswordResetEmailSender = {
      send: vi.fn().mockImplementation(async (params: SendPasswordResetEmailParams) => {
        sentEmails.push(params);
      }),
    };

    const auditedEvents: AuditEvent[] = [];
    const mockAuditLogger: AuditLogger = {
      log: vi.fn().mockImplementation(async (event: AuditEvent) => {
        auditedEvents.push(event);
      }),
    };

    const runner = new DirectDetachedTaskRunner();

    const useCase = new RequestPasswordRecoveryUseCase({
      userRepository: mockUserRepo,
      activationTokenRepository: mockTokenRepo,
      activationTokenIssuer: mockTokenIssuer,
      passwordResetEmailSender: mockEmailSender,
      unitOfWork: synchronousUnitOfWork,
      auditLogger: mockAuditLogger,
      detachedTaskRunner: runner,
      clock: () => now,
    });

    const response = await useCase.execute({
      email: 'carlos.docente@untrm.edu.pe',
      ip: '200.48.50.1',
    });

    // 1. Respuesta pública
    expect(response).toEqual({ status: 'RECEIVED' });

    // 2. Emisión de token
    expect(mockTokenIssuer.issue).toHaveBeenCalledWith('user-active-1', now, 'user-active-1');

    // 3. Auditoría en User sin correo, token ni hash
    expect(mockAuditLogger.log).toHaveBeenCalledTimes(1);
    expect(auditedEvents[0]).toEqual({
      action: 'UPDATE',
      entity: 'User',
      entityId: 'user-active-1',
      actor: 'user-active-1',
      ip: '200.48.50.1',
      after: {
        passwordRecoveryRequested: true,
        expiresAt: expiresAt.toISOString(),
      },
    });

    // 4. Envío de correo
    expect(runner.executed).toBe(1);
    expect(mockEmailSender.send).toHaveBeenCalledTimes(1);
    expect(sentEmails[0]).toEqual({
      to: 'carlos.docente@untrm.edu.pe',
      names: 'Carlos',
      rawToken: 'raw-recovery-token-12345',
      expiresAt,
    });
  });

  it('skips silently without audit or email when user is not found', async () => {
    const mockUserRepo: UserRepository = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      findByEmail: vi.fn(),
      findByEmailForUpdate: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      saveActivation: vi.fn(),
      savePasswordReset: vi.fn(),
    };

    const mockTokenRepo: ActivationTokenRepository = {
      add: vi.fn(),
      findByTokenHash: vi.fn(),
      findByTokenHashForUpdate: vi.fn(),
      save: vi.fn(),
      revokePendingByUserId: vi.fn(),
      findLatestCreatedAtByUserId: vi.fn(),
    };

    const mockTokenIssuer = {
      issue: vi.fn(),
    } as unknown as ActivationTokenIssuerService;

    const mockEmailSender: PasswordResetEmailSender = {
      send: vi.fn(),
    };

    const mockAuditLogger: AuditLogger = {
      log: vi.fn(),
    };

    const runner = new DirectDetachedTaskRunner();

    const useCase = new RequestPasswordRecoveryUseCase({
      userRepository: mockUserRepo,
      activationTokenRepository: mockTokenRepo,
      activationTokenIssuer: mockTokenIssuer,
      passwordResetEmailSender: mockEmailSender,
      unitOfWork: synchronousUnitOfWork,
      auditLogger: mockAuditLogger,
      detachedTaskRunner: runner,
    });

    const response = await useCase.execute({
      email: 'nonexistent@untrm.edu.pe',
    });

    expect(response).toEqual({ status: 'RECEIVED' });
    expect(mockTokenIssuer.issue).not.toHaveBeenCalled();
    expect(mockAuditLogger.log).not.toHaveBeenCalled();
    expect(mockEmailSender.send).not.toHaveBeenCalled();
    expect(runner.executed).toBe(0);
  });

  it('skips silently without audit or email when user is not ACTIVE (INACTIVE or PENDING_ACTIVATION)', async () => {
    for (const nonActiveUser of [inactiveUser, pendingUser]) {
      const mockUserRepo: UserRepository = {
        findById: vi.fn(),
        findByIdForUpdate: vi.fn(),
        findByEmail: vi.fn(),
        findByEmailForUpdate: vi.fn().mockResolvedValue(nonActiveUser),
        save: vi.fn(),
        saveActivation: vi.fn(),
        savePasswordReset: vi.fn(),
      };

      const mockTokenRepo: ActivationTokenRepository = {
        add: vi.fn(),
        findByTokenHash: vi.fn(),
        findByTokenHashForUpdate: vi.fn(),
        save: vi.fn(),
        revokePendingByUserId: vi.fn(),
        findLatestCreatedAtByUserId: vi.fn().mockResolvedValue(null),
      };

      const mockTokenIssuer = {
        issue: vi.fn(),
      } as unknown as ActivationTokenIssuerService;

      const mockEmailSender: PasswordResetEmailSender = {
        send: vi.fn(),
      };

      const mockAuditLogger: AuditLogger = {
        log: vi.fn(),
      };

      const runner = new DirectDetachedTaskRunner();

      const useCase = new RequestPasswordRecoveryUseCase({
        userRepository: mockUserRepo,
        activationTokenRepository: mockTokenRepo,
        activationTokenIssuer: mockTokenIssuer,
        passwordResetEmailSender: mockEmailSender,
        unitOfWork: synchronousUnitOfWork,
        auditLogger: mockAuditLogger,
        detachedTaskRunner: runner,
      });

      const response = await useCase.execute({
        email: nonActiveUser.email,
      });

      expect(response).toEqual({ status: 'RECEIVED' });
      expect(mockTokenIssuer.issue).not.toHaveBeenCalled();
      expect(mockAuditLogger.log).not.toHaveBeenCalled();
      expect(mockEmailSender.send).not.toHaveBeenCalled();
      expect(runner.executed).toBe(0);
    }
  });

  it('skips silently if cooldown period (< 60s) has not elapsed', async () => {
    const now = new Date('2026-11-06T12:00:30.000Z');
    const recentTokenDate = new Date('2026-11-06T12:00:00.000Z'); // 30s atrás (< 60s)

    const mockUserRepo: UserRepository = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      findByEmail: vi.fn(),
      findByEmailForUpdate: vi.fn().mockResolvedValue(activeUser),
      save: vi.fn(),
      saveActivation: vi.fn(),
      savePasswordReset: vi.fn(),
    };

    const mockTokenRepo: ActivationTokenRepository = {
      add: vi.fn(),
      findByTokenHash: vi.fn(),
      findByTokenHashForUpdate: vi.fn(),
      save: vi.fn(),
      revokePendingByUserId: vi.fn(),
      findLatestCreatedAtByUserId: vi.fn().mockResolvedValue(recentTokenDate),
    };

    const mockTokenIssuer = {
      issue: vi.fn(),
    } as unknown as ActivationTokenIssuerService;

    const mockEmailSender: PasswordResetEmailSender = {
      send: vi.fn(),
    };

    const mockAuditLogger: AuditLogger = {
      log: vi.fn(),
    };

    const runner = new DirectDetachedTaskRunner();

    const useCase = new RequestPasswordRecoveryUseCase({
      userRepository: mockUserRepo,
      activationTokenRepository: mockTokenRepo,
      activationTokenIssuer: mockTokenIssuer,
      passwordResetEmailSender: mockEmailSender,
      unitOfWork: synchronousUnitOfWork,
      auditLogger: mockAuditLogger,
      detachedTaskRunner: runner,
      clock: () => now,
    });

    const response = await useCase.execute({
      email: activeUser.email,
    });

    expect(response).toEqual({ status: 'RECEIVED' });
    expect(mockTokenIssuer.issue).not.toHaveBeenCalled();
    expect(mockAuditLogger.log).not.toHaveBeenCalled();
    expect(mockEmailSender.send).not.toHaveBeenCalled();
    expect(runner.executed).toBe(0);
  });

  it('issues a new token when cooldown period (>= 60s) has elapsed', async () => {
    const now = new Date('2026-11-06T12:01:05.000Z');
    const oldTokenDate = new Date('2026-11-06T12:00:00.000Z'); // 65s atrás (>= 60s)

    const mockUserRepo: UserRepository = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      findByEmail: vi.fn(),
      findByEmailForUpdate: vi.fn().mockResolvedValue(activeUser),
      save: vi.fn(),
      saveActivation: vi.fn(),
      savePasswordReset: vi.fn(),
    };

    const mockTokenRepo: ActivationTokenRepository = {
      add: vi.fn(),
      findByTokenHash: vi.fn(),
      findByTokenHashForUpdate: vi.fn(),
      save: vi.fn(),
      revokePendingByUserId: vi.fn(),
      findLatestCreatedAtByUserId: vi.fn().mockResolvedValue(oldTokenDate),
    };

    const mockTokenIssuer = {
      issue: vi.fn().mockResolvedValue({
        token: 'new-recovery-token',
        expiresAt: new Date('2026-11-08T12:01:05.000Z'),
      }),
    } as unknown as ActivationTokenIssuerService;

    const mockEmailSender: PasswordResetEmailSender = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const mockAuditLogger: AuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    const runner = new DirectDetachedTaskRunner();

    const useCase = new RequestPasswordRecoveryUseCase({
      userRepository: mockUserRepo,
      activationTokenRepository: mockTokenRepo,
      activationTokenIssuer: mockTokenIssuer,
      passwordResetEmailSender: mockEmailSender,
      unitOfWork: synchronousUnitOfWork,
      auditLogger: mockAuditLogger,
      detachedTaskRunner: runner,
      clock: () => now,
    });

    const response = await useCase.execute({
      email: activeUser.email,
    });

    expect(response).toEqual({ status: 'RECEIVED' });
    expect(mockTokenIssuer.issue).toHaveBeenCalledWith('user-active-1', now, 'user-active-1');
    expect(mockAuditLogger.log).toHaveBeenCalledTimes(1);
    expect(mockEmailSender.send).toHaveBeenCalledTimes(1);
  });

  it('does not propagate failure when email sender throws in detached runner', async () => {
    const mockUserRepo: UserRepository = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      findByEmail: vi.fn(),
      findByEmailForUpdate: vi.fn().mockResolvedValue(activeUser),
      save: vi.fn(),
      saveActivation: vi.fn(),
      savePasswordReset: vi.fn(),
    };

    const mockTokenRepo: ActivationTokenRepository = {
      add: vi.fn(),
      findByTokenHash: vi.fn(),
      findByTokenHashForUpdate: vi.fn(),
      save: vi.fn(),
      revokePendingByUserId: vi.fn(),
      findLatestCreatedAtByUserId: vi.fn().mockResolvedValue(null),
    };

    const mockTokenIssuer = {
      issue: vi.fn().mockResolvedValue({
        token: 'token-with-email-err',
        expiresAt: new Date('2026-11-08T12:00:00.000Z'),
      }),
    } as unknown as ActivationTokenIssuerService;

    const mockEmailSender: PasswordResetEmailSender = {
      send: vi.fn().mockRejectedValue(new Error('SMTP service down')),
    };

    const mockAuditLogger: AuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    const runner = new DirectDetachedTaskRunner();

    const useCase = new RequestPasswordRecoveryUseCase({
      userRepository: mockUserRepo,
      activationTokenRepository: mockTokenRepo,
      activationTokenIssuer: mockTokenIssuer,
      passwordResetEmailSender: mockEmailSender,
      unitOfWork: synchronousUnitOfWork,
      auditLogger: mockAuditLogger,
      detachedTaskRunner: runner,
    });

    // La promesa del caso de uso debe resolver sin lanzar
    await expect(useCase.execute({ email: activeUser.email })).resolves.toEqual({
      status: 'RECEIVED',
    });

    // El error quedó contenido en el runner sin interrumpir el caso de uso
    expect(runner.errors).toHaveLength(1);
    expect((runner.errors[0] as Error).message).toBe('SMTP service down');
  });
});
