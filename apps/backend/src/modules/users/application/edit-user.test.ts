import { describe, expect, it, vi } from 'vitest';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { User } from '../domain/entities/user.js';
import {
  UserDniAlreadyExistsError,
  UserEmailAlreadyExistsError,
  UserNotFoundError,
} from '../domain/errors/index.js';
import type { PermissionChecker, UserRepository, UserRoleGateway } from '../domain/ports/index.js';
import { EditUserUseCase } from './edit-user.js';
import type { EditUserCommand } from './edit-user.types.js';

describe('EditUserUseCase Unit Tests (T-003-05, T-003-20, RS-002, RS-020, D6, D7)', () => {
  const existingUserId = 'target-user-uuid';

  function createExistingUser(overrides: Partial<Parameters<typeof User.restore>[0]> = {}): User {
    return User.restore({
      id: existingUserId,
      names: 'Carlos',
      firstSurname: 'López',
      secondSurname: 'Mendoza',
      email: 'carlos.lopez@untrm.edu.pe',
      dni: '12345678',
      status: 'ACTIVE',
      lastLoginAt: new Date('2026-11-01T10:00:00.000Z'),
      createdBy: 'creator-admin-uuid',
      updatedBy: null,
      createdAt: new Date('2026-10-01T08:00:00.000Z'),
      updatedAt: new Date('2026-10-01T08:00:00.000Z'),
      ...overrides,
    });
  }

  function setupMocks() {
    const existingUser = createExistingUser();

    const userRepository: UserRepository = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn().mockResolvedValue(existingUser),
      findByEmail: vi.fn().mockResolvedValue(null),
      findByDni: vi.fn().mockResolvedValue(null),
      add: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const userRoleGateway: UserRoleGateway = {
      replaceRoles: vi.fn().mockResolvedValue(undefined),
      getRoleIds: vi.fn().mockResolvedValue(new Map([[existingUserId, ['role-teacher-uuid']]])),
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

    const useCase = new EditUserUseCase({
      userRepository,
      userRoleGateway,
      permissionChecker,
      auditLogger,
      unitOfWork,
    });

    return {
      useCase,
      userRepository,
      userRoleGateway,
      permissionChecker,
      auditLogger,
      unitOfWork,
      existingUser,
    };
  }

  const baseCommand: EditUserCommand = {
    actorId: 'admin-updater-uuid',
    ip: '10.0.0.1',
    userId: existingUserId,
    input: {
      names: 'Carlos Alberto',
      firstSurname: 'López',
      secondSurname: 'Mendoza',
      email: 'carlos.alberto@untrm.edu.pe',
      dni: '87654321',
    },
  };

  it('updates profile fields and audits before and after', async () => {
    const { useCase, userRepository, auditLogger } = setupMocks();

    const dto = await useCase.execute(baseCommand);

    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(dto.names).toBe('Carlos Alberto');
    expect(dto.email).toBe('carlos.alberto@untrm.edu.pe');
    expect(dto.dni).toBe('87654321');
    expect(dto.roleIds).toEqual(['role-teacher-uuid']);

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        entity: 'User',
        entityId: existingUserId,
        actor: 'admin-updater-uuid',
        ip: '10.0.0.1',
        before: expect.objectContaining({
          names: 'Carlos',
          dni: '******78',
          roleIds: ['role-teacher-uuid'],
        }),
        after: expect.objectContaining({
          names: 'Carlos Alberto',
          dni: '******21',
          roleIds: ['role-teacher-uuid'],
        }),
      }),
    );
  });

  it('rejects a duplicated email or dni of another user', async () => {
    const { useCase, userRepository, auditLogger } = setupMocks();

    vi.mocked(userRepository.findByEmail).mockResolvedValueOnce({
      id: 'other-user-uuid',
    } as unknown as User);

    await expect(useCase.execute(baseCommand)).rejects.toThrow(UserEmailAlreadyExistsError);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();

    vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(null);
    vi.mocked(userRepository.findByDni).mockResolvedValueOnce({
      id: 'other-dni-user-uuid',
    } as unknown as User);

    await expect(useCase.execute(baseCommand)).rejects.toThrow(UserDniAlreadyExistsError);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('allows keeping its own email and dni', async () => {
    const { useCase, userRepository, auditLogger, existingUser } = setupMocks();

    vi.mocked(userRepository.findByEmail).mockResolvedValueOnce({
      id: existingUserId,
    } as unknown as User);
    vi.mocked(userRepository.findByDni).mockResolvedValueOnce({
      id: existingUserId,
    } as unknown as User);

    const dto = await useCase.execute({
      ...baseCommand,
      input: {
        names: 'Carlos Modificado',
        email: existingUser.email,
        dni: existingUser.dni ?? '12345678',
      },
    });

    expect(dto.names).toBe('Carlos Modificado');
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
  });

  it('does nothing and does not audit when nothing changes (D7)', async () => {
    const { useCase, userRepository, auditLogger, existingUser } = setupMocks();

    const dto = await useCase.execute({
      ...baseCommand,
      input: {
        names: existingUser.names,
        firstSurname: existingUser.firstSurname,
        secondSurname: existingUser.secondSurname,
        email: existingUser.email,
        dni: existingUser.dni ?? '12345678',
      },
    });

    expect(userRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(dto.id).toBe(existingUserId);
    expect(dto.names).toBe(existingUser.names);
  });

  it('returns not found for an unknown user', async () => {
    const { useCase, userRepository, auditLogger } = setupMocks();
    vi.mocked(userRepository.findByIdForUpdate).mockResolvedValueOnce(null);

    await expect(useCase.execute(baseCommand)).rejects.toThrow(UserNotFoundError);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('denies without usuario.editar and reads nothing', async () => {
    const { useCase, permissionChecker, userRepository, unitOfWork } = setupMocks();
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('Permiso denegado'),
    );

    await expect(useCase.execute(baseCommand)).rejects.toThrow(ForbiddenError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(userRepository.findByIdForUpdate).not.toHaveBeenCalled();
  });

  it('does not change status or roles', async () => {
    const { useCase, existingUser, userRoleGateway } = setupMocks();

    const dto = await useCase.execute(baseCommand);

    expect(dto.status).toBe('ACTIVE');
    expect(existingUser.status).toBe('ACTIVE');
    expect(userRoleGateway.replaceRoles).not.toHaveBeenCalled();
  });

  it('audits in the same transaction', async () => {
    const { useCase, unitOfWork, auditLogger } = setupMocks();

    let inTxWhenAudited = false;
    vi.mocked(auditLogger.log).mockImplementation(async () => {
      inTxWhenAudited = unitOfWork.inTx;
    });

    await useCase.execute(baseCommand);

    expect(inTxWhenAudited).toBe(true);
  });
});
