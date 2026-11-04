import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { User } from '../domain/entities/user.js';
import type { PermissionChecker, UserListReader, UserRoleGateway } from '../domain/ports/index.js';
import { ListUsersUseCase } from './list-users.js';
import type { ListUsersCommand } from './list-users.types.js';

describe('ListUsersUseCase Unit Tests (T-003-07, T-003-22, CA4, RS-002, D10)', () => {
  const adminActorId = 'admin-actor-uuid';

  function createTestUser(id: string, name: string): User {
    return User.restore({
      id,
      names: name,
      firstSurname: 'Pérez',
      secondSurname: 'López',
      email: `${name.toLowerCase()}@untrm.edu.pe`,
      dni: `7766554${id.slice(-1)}`,
      status: 'ACTIVE',
      lastLoginAt: null,
      createdBy: 'creator-uuid',
      updatedBy: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });
  }

  function setupMocks() {
    const user1 = createTestUser('user-uuid-1', 'Ana');
    const user2 = createTestUser('user-uuid-2', 'Bruno');

    const userListReader: UserListReader = {
      list: vi.fn().mockResolvedValue({
        items: [user1, user2],
        total: 2,
      }),
    };

    const userRoleGateway: UserRoleGateway = {
      replaceRoles: vi.fn(),
      getRoleIds: vi.fn().mockResolvedValue(
        new Map([
          ['user-uuid-1', ['role-admin-uuid']],
          ['user-uuid-2', ['role-teacher-uuid']],
        ]),
      ),
    };

    const permissionChecker: PermissionChecker = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };

    const useCase = new ListUsersUseCase({
      userListReader,
      userRoleGateway,
      permissionChecker,
    });

    return {
      useCase,
      userListReader,
      userRoleGateway,
      permissionChecker,
      user1,
      user2,
    };
  }

  const baseCommand: ListUsersCommand = {
    actorId: adminActorId,
    query: {
      status: 'ACTIVE',
      roleId: 'role-admin-uuid',
      page: 1,
      pageSize: 10,
    },
  };

  it('filters by status and role and paginates (CA4)', async () => {
    const { useCase, userListReader } = setupMocks();

    const result = await useCase.execute(baseCommand);

    expect(userListReader.list).toHaveBeenCalledWith({
      status: 'ACTIVE',
      roleId: 'role-admin-uuid',
      page: 1,
      pageSize: 10,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.names).toBe('Ana');
    expect(result.items[0]!.roleIds).toEqual(['role-admin-uuid']);
    expect(result.items[1]!.names).toBe('Bruno');
    expect(result.items[1]!.roleIds).toEqual(['role-teacher-uuid']);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(1);
  });

  it('computes total pages and handles empty results', async () => {
    const { useCase, userListReader } = setupMocks();

    // Caso 1: 25 elementos con pageSize 10 -> 3 páginas
    vi.mocked(userListReader.list).mockResolvedValueOnce({
      items: [],
      total: 25,
    });

    const resultPaged = await useCase.execute({
      actorId: adminActorId,
      query: { page: 3, pageSize: 10 },
    });
    expect(resultPaged.totalPages).toBe(3);
    expect(resultPaged.total).toBe(25);
    expect(resultPaged.items).toEqual([]);

    // Caso 2: 0 elementos -> 0 páginas
    vi.mocked(userListReader.list).mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    const resultEmpty = await useCase.execute({
      actorId: adminActorId,
      query: { page: 1, pageSize: 10 },
    });
    expect(resultEmpty.totalPages).toBe(0);
    expect(resultEmpty.total).toBe(0);
    expect(resultEmpty.items).toEqual([]);
  });

  it('loads roles for the page in one call', async () => {
    const { useCase, userRoleGateway } = setupMocks();

    await useCase.execute(baseCommand);

    expect(userRoleGateway.getRoleIds).toHaveBeenCalledTimes(1);
    expect(userRoleGateway.getRoleIds).toHaveBeenCalledWith(['user-uuid-1', 'user-uuid-2']);
  });

  it('denies without usuario.ver and reads nothing', async () => {
    const { useCase, permissionChecker, userListReader, userRoleGateway } = setupMocks();
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('Permiso denegado'),
    );

    await expect(useCase.execute(baseCommand)).rejects.toThrow(ForbiddenError);
    expect(userListReader.list).not.toHaveBeenCalled();
    expect(userRoleGateway.getRoleIds).not.toHaveBeenCalled();
  });

  it('applies the default page and page size', async () => {
    const { useCase, userListReader } = setupMocks();

    const result = await useCase.execute({
      actorId: adminActorId,
      query: {},
    });

    expect(userListReader.list).toHaveBeenCalledWith({
      status: undefined,
      roleId: undefined,
      page: 1,
      pageSize: 10,
    });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });
});
