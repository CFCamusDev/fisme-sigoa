import { describe, expect, it, vi } from 'vitest';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  UserDniAlreadyExistsError,
  UserEmailAlreadyExistsError,
  UnknownRoleError,
} from '../domain/errors/index.js';
import type {
  ActivationEmailSender,
  ActivationTokenIssuer,
  PermissionChecker,
  UserRepository,
  UserRoleGateway,
} from '../domain/ports/index.js';
import { CreateUserUseCase } from './create-user.js';
import type { CreateUserCommand } from './create-user.types.js';

describe('CreateUserUseCase Unit Tests (T-003-04, T-003-19, CA1, CA2, RS-002, RS-020)', () => {
  const baseCommand: CreateUserCommand = {
    actorId: 'admin-actor-uuid',
    ip: '192.168.1.1',
    input: {
      names: 'Juan Carlos',
      firstSurname: 'Pérez',
      secondSurname: 'Gómez',
      email: 'juan.perez@untrm.edu.pe',
      dni: '12345678',
      roleIds: ['role-admin-uuid'],
    },
  };

  function createTestUow(): UnitOfWork & { inTx: boolean } {
    return {
      inTx: false,
      async run<T>(fn: () => Promise<T>): Promise<T> {
        this.inTx = true;
        try {
          return await fn();
        } finally {
          this.inTx = false;
        }
      },
    };
  }

  function setupMocks() {
    const userRepository: UserRepository = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(null),
      findByDni: vi.fn().mockResolvedValue(null),
      add: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const permissionChecker: PermissionChecker = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };

    const userRoleGateway: UserRoleGateway = {
      replaceRoles: vi.fn().mockResolvedValue(undefined),
      getRoleIds: vi.fn().mockResolvedValue(new Map()),
    };

    const activationTokenIssuer: ActivationTokenIssuer = {
      issue: vi.fn().mockResolvedValue({
        token: 'raw-activation-token-32b',
        expiresAt: new Date('2026-11-05T20:00:00.000Z'),
      }),
    };

    const activationEmailSender: ActivationEmailSender = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const auditLogger: AuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    const uow = createTestUow();
    const logger = { error: vi.fn() };

    const useCase = new CreateUserUseCase({
      userRepository,
      permissionChecker,
      userRoleGateway,
      activationTokenIssuer,
      activationEmailSender,
      unitOfWork: uow,
      auditLogger,
      idGenerator: () => 'fixed-new-user-id',
      clock: () => new Date('2026-11-03T20:00:00.000Z'),
      logger,
    });

    return {
      useCase,
      userRepository,
      permissionChecker,
      userRoleGateway,
      activationTokenIssuer,
      activationEmailSender,
      auditLogger,
      uow,
      logger,
    };
  }

  it('creates a pending user, audits it and sends the activation email (CA1)', async () => {
    const {
      useCase,
      permissionChecker,
      userRepository,
      userRoleGateway,
      activationTokenIssuer,
      activationEmailSender,
      auditLogger,
    } = setupMocks();

    const dto = await useCase.execute(baseCommand);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'admin-actor-uuid',
      permission: 'usuario.crear',
      scope: 'GLOBAL',
    });
    expect(userRepository.add).toHaveBeenCalledTimes(1);
    expect(userRoleGateway.replaceRoles).toHaveBeenCalledWith('fixed-new-user-id', [
      'role-admin-uuid',
    ]);
    expect(activationTokenIssuer.issue).toHaveBeenCalledWith(
      'fixed-new-user-id',
      new Date('2026-11-03T20:00:00.000Z'),
    );
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'User',
        entityId: 'fixed-new-user-id',
        actorId: 'admin-actor-uuid',
        ipAddress: '192.168.1.1',
      }),
    );
    expect(activationEmailSender.send).toHaveBeenCalledWith({
      to: 'juan.perez@untrm.edu.pe',
      names: 'Juan Carlos',
      activationToken: 'raw-activation-token-32b',
      expiresAt: new Date('2026-11-05T20:00:00.000Z'),
    });
    expect(dto.id).toBe('fixed-new-user-id');
    expect(dto.status).toBe('PENDING_ACTIVATION');
    expect(dto.roleIds).toEqual(['role-admin-uuid']);
  });

  it('rejects a duplicated email or dni (CA2)', async () => {
    const { useCase, userRepository, activationEmailSender, auditLogger } = setupMocks();
    vi.mocked(userRepository.findByEmail).mockResolvedValueOnce({
      id: 'existing-id',
    } as unknown as User);

    await expect(useCase.execute(baseCommand)).rejects.toThrow(UserEmailAlreadyExistsError);
    expect(activationEmailSender.send).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();

    vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(null);
    vi.mocked(userRepository.findByDni).mockResolvedValueOnce({
      id: 'existing-dni-id',
    } as unknown as User);

    await expect(useCase.execute(baseCommand)).rejects.toThrow(UserDniAlreadyExistsError);
  });

  it('denies without usuario.crear and reads nothing', async () => {
    const { useCase, permissionChecker, userRepository } = setupMocks();
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('Permiso denegado'),
    );

    await expect(useCase.execute(baseCommand)).rejects.toThrow(ForbiddenError);
    expect(userRepository.findByEmail).not.toHaveBeenCalled();
    expect(userRepository.findByDni).not.toHaveBeenCalled();
  });

  it('audits in the same transaction', async () => {
    const { useCase, uow, auditLogger } = setupMocks();
    let wasInTx = false;
    vi.mocked(auditLogger.log).mockImplementation(async () => {
      wasInTx = uow.inTx;
    });

    await useCase.execute(baseCommand);
    expect(wasInTx).toBe(true);
  });

  it('audit payload masks the dni and never contains the activation token', async () => {
    const { useCase, auditLogger } = setupMocks();
    await useCase.execute(baseCommand);

    const callArg = vi.mocked(auditLogger.log).mock.calls[0][0];
    const after = callArg.after as Record<string, unknown>;

    expect(after.dni).toBe('******78');
    expect(after.token).toBeUndefined();
    expect(after.activationToken).toBeUndefined();
    expect(JSON.stringify(callArg)).not.toContain('raw-activation-token-32b');
  });

  it('rolls back everything when the role gateway fails', async () => {
    const { useCase, userRoleGateway, activationEmailSender, auditLogger } = setupMocks();
    vi.mocked(userRoleGateway.replaceRoles).mockRejectedValueOnce(
      new UnknownRoleError('Rol no existe'),
    );

    await expect(useCase.execute(baseCommand)).rejects.toThrow(UnknownRoleError);
    expect(activationEmailSender.send).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rolls back when the token cannot be issued', async () => {
    const { useCase, activationTokenIssuer, activationEmailSender, auditLogger } = setupMocks();
    vi.mocked(activationTokenIssuer.issue).mockRejectedValueOnce(
      new Error('Token generation failure'),
    );

    await expect(useCase.execute(baseCommand)).rejects.toThrow('Token generation failure');
    expect(activationEmailSender.send).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('keeps the user when the activation email fails and logs without personal data', async () => {
    const { useCase, activationEmailSender, logger } = setupMocks();
    vi.mocked(activationEmailSender.send).mockRejectedValueOnce(new Error('SMTP down'));

    const dto = await useCase.execute(baseCommand);
    expect(dto).toBeDefined();
    expect(dto.id).toBe('fixed-new-user-id');
    expect(logger.error).toHaveBeenCalledTimes(1);

    const logMessage = logger.error.mock.calls[0][0];
    expect(logMessage).not.toContain('juan.perez@untrm.edu.pe');
    expect(logMessage).not.toContain('12345678');
    expect(logMessage).not.toContain('raw-activation-token-32b');
  });

  it('sends the email only after the transaction commits', async () => {
    const { useCase, uow, activationEmailSender } = setupMocks();
    let inTxWhenEmailSent = true;
    vi.mocked(activationEmailSender.send).mockImplementation(async () => {
      inTxWhenEmailSent = uow.inTx;
    });

    await useCase.execute(baseCommand);
    expect(inTxWhenEmailSent).toBe(false);
  });

  it('returns a dto without credentials', async () => {
    const { useCase } = setupMocks();
    const dto = await useCase.execute(baseCommand);

    const rawDto = dto as unknown as Record<string, unknown>;
    expect(rawDto.passwordHash).toBeUndefined();
    expect(rawDto.token).toBeUndefined();
    expect(rawDto.activationToken).toBeUndefined();
    expect(rawDto.failedLoginAttempts).toBeUndefined();
    expect(rawDto.lockedUntil).toBeUndefined();
  });
});
