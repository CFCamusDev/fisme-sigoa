import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { RoleDto } from '@sigoa/shared';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { RoleReader } from '../domain/ports/role-reader.js';
import { ListRolesUseCase } from './list-roles.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';

describe('ListRolesUseCase Unit Tests (HU-006, T-006-26, A2.2, RS-002, LS 3.2)', () => {
  const adminActorId = 'admin-actor-uuid';

  const mockRoles: RoleDto[] = [
    {
      id: 'role-admin',
      code: 'ADMINISTRATOR',
      name: 'Administrador',
      description: 'Acceso total',
      isPredefined: true,
      status: 'ACTIVE',
      deactivatedAt: null,
      userCount: 1,
      permissions: [
        {
          permissionCode: 'rol.ver',
          scope: 'GLOBAL',
        },
      ],
      updatedAt: '2026-11-06T15:00:00.000Z',
    },
    {
      id: 'role-teacher',
      code: 'TEACHER',
      name: 'Docente',
      description: null,
      isPredefined: true,
      status: 'ACTIVE',
      deactivatedAt: null,
      userCount: 0,
      permissions: [],
      updatedAt: '2026-11-06T15:00:00.000Z',
    },
  ];

  function setupMocks() {
    const roleReader: RoleReader = {
      listAll: vi.fn().mockResolvedValue(mockRoles),
      findById: vi.fn().mockResolvedValue(null),
    };

    const authorizer = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as PermissionAuthorizer;

    const useCase = new ListRolesUseCase({
      roleReader,
      authorizer,
    });

    return { useCase, roleReader, authorizer };
  }

  it('denies without rol.ver and reads nothing', async () => {
    const { useCase, authorizer, roleReader } = setupMocks();
    vi.mocked(authorizer.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('Permiso denegado para rol.ver'),
    );

    await expect(useCase.execute({ actorId: 'unauthorized-actor' })).rejects.toThrow(
      ForbiddenError,
    );
    expect(roleReader.listAll).not.toHaveBeenCalled();
  });

  it('checks the permission before reading', async () => {
    const callOrder: string[] = [];

    const roleReader: RoleReader = {
      listAll: vi.fn().mockImplementation(async () => {
        callOrder.push('listAll');
        return mockRoles;
      }),
      findById: vi.fn().mockResolvedValue(null),
    };

    const authorizer = {
      assertAllowed: vi.fn().mockImplementation(async () => {
        callOrder.push('assertAllowed');
      }),
    } as unknown as PermissionAuthorizer;

    const useCase = new ListRolesUseCase({ roleReader, authorizer });
    await useCase.execute({ actorId: adminActorId });

    expect(callOrder).toEqual(['assertAllowed', 'listAll']);
  });

  it('returns the detailed roles', async () => {
    const { useCase, authorizer, roleReader } = setupMocks();

    const result = await useCase.execute({ actorId: adminActorId });

    expect(authorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: adminActorId,
      permission: 'rol.ver',
      scope: 'GLOBAL',
    });
    expect(roleReader.listAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: mockRoles });
  });

  it('returns an empty list', async () => {
    const { useCase, roleReader } = setupMocks();
    vi.mocked(roleReader.listAll).mockResolvedValueOnce([]);

    const result = await useCase.execute({ actorId: adminActorId });

    expect(result).toEqual({ items: [] });
  });

  it('rejects a malformed reader result instead of responding', async () => {
    const { useCase, roleReader } = setupMocks();
    // Inyectamos un objeto incompleto (falta status, permissions, userCount)
    const malformedRoles = [
      {
        id: 'role-invalid',
        code: 'INVALID',
        name: 'Rol Inválido',
        description: null,
        isPredefined: false,
      },
    ] as unknown as RoleDto[];
    vi.mocked(roleReader.listAll).mockResolvedValueOnce(malformedRoles);

    await expect(useCase.execute({ actorId: adminActorId })).rejects.toThrow(ZodError);
  });
});
