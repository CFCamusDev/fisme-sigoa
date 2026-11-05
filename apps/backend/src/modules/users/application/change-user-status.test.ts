import { describe, expect, it, vi } from 'vitest';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { User } from '../domain/entities/user.js';
import {
  CannotDeactivateSelfError,
  InvalidUserStatusTransitionError,
  UserNotFoundError,
} from '../domain/errors/index.js';
import type {
  PermissionChecker,
  UserRepository,
  UserRoleGateway,
  UserSessionRevoker,
} from '../domain/ports/index.js';
import { ChangeUserStatusUseCase } from './change-user-status.js';
import type { ChangeUserStatusCommand } from './change-user-status.types.js';

describe('ChangeUserStatusUseCase Unit Tests (T-003-06, T-003-21, CA3, RS-020, LS 5.14, D5, D9)', () => {
  const targetUserId = 'target-user-uuid';
  const adminActorId = 'admin-actor-uuid';
  const fixedNow = new Date('2026-11-03T16:00:00.000Z');

  function createTestUser(status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION'): User {
    return User.restore({
      id: targetUserId,
      names: 'Elena',
      firstSurname: 'Ramos',
      secondSurname: null,
      email: 'elena.ramos@untrm.edu.pe',
      dni: '87654321',
      status,
      lastLoginAt: new Date('2026-11-01T12:00:00.000Z'),
      createdBy: 'creator-uuid',
      updatedBy: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });
  }

  function setupMocks(initialStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION' = 'ACTIVE') {
    const user = createTestUser(initialStatus);

    const userRepository: UserRepository = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn().mockResolvedValue(user),
      findByEmail: vi.fn(),
      findByDni: vi.fn(),
      add: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const userRoleGateway: UserRoleGateway = {
      replaceRoles: vi.fn().mockResolvedValue(undefined),
      getRoleIds: vi.fn().mockResolvedValue(new Map([[targetUserId, ['role-admin-uuid']]])),
    };

    const userSessionRevoker: UserSessionRevoker = {
      revokeAllForUser: vi.fn().mockResolvedValue(3),
    };

    const permissionChecker: PermissionChecker = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };

    const auditLogger: AuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    let inTx = false;
    const unitOfWork: UnitOfWork & { inTx: boolean } = {
      get inTx() {
        return inTx;
      },
      run: vi.fn().mockImplementation(async <T>(work: () => Promise<T>): Promise<T> => {
        inTx = true;
        try {
          return await work();
        } finally {
          inTx = false;
        }
      }),
    };

    const useCase = new ChangeUserStatusUseCase({
      userRepository,
      userRoleGateway,
      userSessionRevoker,
      permissionChecker,
      auditLogger,
      unitOfWork,
      clock: () => fixedNow,
    });

    return {
      useCase,
      userRepository,
      userRoleGateway,
      userSessionRevoker,
      permissionChecker,
      auditLogger,
      unitOfWork,
      user,
    };
  }

  const deactivateCommand: ChangeUserStatusCommand = {
    actorId: adminActorId,
    ip: '192.168.1.100',
    userId: targetUserId,
    input: { status: 'INACTIVE' },
  };

  const reactivateCommand: ChangeUserStatusCommand = {
    actorId: adminActorId,
    ip: '192.168.1.100',
    userId: targetUserId,
    input: { status: 'ACTIVE' },
  };

  it('deactivates an active user and revokes its refresh tokens in the same transaction (CA3, D5)', async () => {
    const { useCase, userRepository, userSessionRevoker, auditLogger, user } = setupMocks('ACTIVE');

    const dto = await useCase.execute(deactivateCommand);

    expect(dto.status).toBe('INACTIVE');
    expect(user.status).toBe('INACTIVE');
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(userSessionRevoker.revokeAllForUser).toHaveBeenCalledWith(targetUserId, fixedNow);

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATE_CHANGE',
        entity: 'User',
        entityId: targetUserId,
        actor: adminActorId,
        ip: '192.168.1.100',
        before: expect.objectContaining({
          status: 'ACTIVE',
          roleIds: ['role-admin-uuid'],
        }),
        after: expect.objectContaining({
          status: 'INACTIVE',
          roleIds: ['role-admin-uuid'],
          revokedSessions: 3,
        }),
      }),
    );
  });

  it('reactivates an inactive user', async () => {
    const { useCase, userRepository, userSessionRevoker, auditLogger, user } =
      setupMocks('INACTIVE');

    const dto = await useCase.execute(reactivateCommand);

    expect(dto.status).toBe('ACTIVE');
    expect(user.status).toBe('ACTIVE');
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(userSessionRevoker.revokeAllForUser).not.toHaveBeenCalled();

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATE_CHANGE',
        entity: 'User',
        entityId: targetUserId,
        actor: adminActorId,
        before: expect.objectContaining({ status: 'INACTIVE' }),
        after: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('rejects deactivating a pending user', async () => {
    const { useCase, userRepository, userSessionRevoker, auditLogger } =
      setupMocks('PENDING_ACTIVATION');

    await expect(useCase.execute(deactivateCommand)).rejects.toThrow(
      InvalidUserStatusTransitionError,
    );
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(userSessionRevoker.revokeAllForUser).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects deactivating an inactive user and reactivating an active one', async () => {
    const { useCase: useCaseInactive } = setupMocks('INACTIVE');
    await expect(useCaseInactive.execute(deactivateCommand)).rejects.toThrow(
      InvalidUserStatusTransitionError,
    );

    const { useCase: useCaseActive } = setupMocks('ACTIVE');
    await expect(useCaseActive.execute(reactivateCommand)).rejects.toThrow(
      InvalidUserStatusTransitionError,
    );
  });

  it('rejects deactivating oneself (D9)', async () => {
    const { useCase, userRepository, userSessionRevoker, auditLogger, unitOfWork } =
      setupMocks('ACTIVE');

    const selfDeactivateCommand: ChangeUserStatusCommand = {
      actorId: targetUserId,
      ip: '127.0.0.1',
      userId: targetUserId,
      input: { status: 'INACTIVE' },
    };

    await expect(useCase.execute(selfDeactivateCommand)).rejects.toThrow(CannotDeactivateSelfError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(userRepository.findByIdForUpdate).not.toHaveBeenCalled();
    expect(userSessionRevoker.revokeAllForUser).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('denies without usuario.editar', async () => {
    const { useCase, permissionChecker, unitOfWork } = setupMocks('ACTIVE');
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('Permiso denegado'),
    );

    await expect(useCase.execute(deactivateCommand)).rejects.toThrow(ForbiddenError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('returns not found when user does not exist', async () => {
    const { useCase, userRepository } = setupMocks('ACTIVE');
    vi.mocked(userRepository.findByIdForUpdate).mockResolvedValueOnce(null);

    await expect(useCase.execute(deactivateCommand)).rejects.toThrow(UserNotFoundError);
  });

  it('audits and revokes in the same transaction', async () => {
    const { useCase, unitOfWork, auditLogger, userSessionRevoker } = setupMocks('ACTIVE');

    let inTxRevoked = false;
    let inTxAudited = false;

    vi.mocked(userSessionRevoker.revokeAllForUser).mockImplementation(async () => {
      inTxRevoked = unitOfWork.inTx;
      return 1;
    });

    vi.mocked(auditLogger.log).mockImplementation(async () => {
      inTxAudited = unitOfWork.inTx;
    });

    await useCase.execute(deactivateCommand);

    expect(inTxRevoked).toBe(true);
    expect(inTxAudited).toBe(true);
  });
});
