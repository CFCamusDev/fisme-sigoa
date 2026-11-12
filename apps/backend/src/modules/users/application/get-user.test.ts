import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { User } from '../domain/entities/user.js';
import { UserNotFoundError } from '../domain/errors/index.js';
import type { PermissionChecker, UserRepository, UserRoleGateway } from '../domain/ports/index.js';
import { GetUserUseCase } from './get-user.js';

describe('GetUserUseCase Unit Tests (A3, HU-003, T-003-15, RS-002, RF-003)', () => {
  const adminActorId = 'admin-actor-uuid';
  const targetUserId = 'target-user-uuid';

  function createTestUser(id: string, dni: string | null = '12345678'): User {
    return User.restore({
      id,
      names: 'Carlos',
      firstSurname: 'Pérez',
      secondSurname: 'Gómez',
      email: 'carlos.perez@untrm.edu.pe',
      dni,
      status: 'ACTIVE',
      lastLoginAt: null,
      createdBy: 'creator-uuid',
      updatedBy: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });
  }

  function setupMocks() {
    const testUser = createTestUser(targetUserId);

    const userRepository: UserRepository = {
      findById: vi.fn().mockResolvedValue(testUser),
      findByIdForUpdate: vi.fn(),
      findByEmail: vi.fn(),
      findByDni: vi.fn(),
      add: vi.fn(),
      save: vi.fn(),
    };

    const userRoleGateway: UserRoleGateway = {
      replaceRoles: vi.fn(),
      getRoleIds: vi.fn().mockResolvedValue(new Map([[targetUserId, ['role-teacher-uuid']]])),
    };

    const permissionChecker: PermissionChecker = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };

    const useCase = new GetUserUseCase({
      userRepository,
      userRoleGateway,
      permissionChecker,
    });

    return { useCase, userRepository, userRoleGateway, permissionChecker, testUser };
  }

  it('denies without usuario.ver and reads nothing', async () => {
    const { useCase, permissionChecker, userRepository, userRoleGateway } = setupMocks();
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('Permiso denegado para usuario.ver'),
    );

    await expect(
      useCase.execute({ actorId: 'unauthorized-actor', userId: targetUserId }),
    ).rejects.toThrow(ForbiddenError);

    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(userRoleGateway.getRoleIds).not.toHaveBeenCalled();
  });

  it('returns the user with its role ids', async () => {
    const { useCase, permissionChecker, userRepository, userRoleGateway } = setupMocks();

    const result = await useCase.execute({
      actorId: adminActorId,
      userId: targetUserId,
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: adminActorId,
      permission: 'usuario.ver',
      scope: 'GLOBAL',
    });
    expect(userRepository.findById).toHaveBeenCalledWith(targetUserId);
    expect(userRoleGateway.getRoleIds).toHaveBeenCalledWith([targetUserId]);

    expect(result.id).toBe(targetUserId);
    expect(result.names).toBe('Carlos');
    expect(result.dni).toBe('12345678');
    expect(result.roleIds).toEqual(['role-teacher-uuid']);
  });

  it('returns not found for an unknown user', async () => {
    const { useCase, userRepository } = setupMocks();
    vi.mocked(userRepository.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute({ actorId: adminActorId, userId: 'unknown-id' })).rejects.toThrow(
      UserNotFoundError,
    );
  });

  it('returns a user without dni without error (dni is null)', async () => {
    const { useCase, userRepository } = setupMocks();
    const noDniUser = createTestUser(targetUserId, null);
    vi.mocked(userRepository.findById).mockResolvedValueOnce(noDniUser);

    const result = await useCase.execute({
      actorId: adminActorId,
      userId: targetUserId,
    });

    expect(result.id).toBe(targetUserId);
    expect(result.dni).toBeNull();
  });
});
