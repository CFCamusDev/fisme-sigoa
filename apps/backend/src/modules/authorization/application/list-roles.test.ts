import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { RoleReader } from '../domain/ports/role-reader.js';
import { ListRolesUseCase } from './list-roles.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';

describe('ListRolesUseCase Unit Tests (A2.2, HU-003, T-003-15, RS-002, LS 3.2)', () => {
  const adminActorId = 'admin-actor-uuid';

  const mockRoles = [
    {
      id: 'role-admin',
      code: 'ADMINISTRATOR',
      name: 'Administrador',
      description: 'Acceso total',
      isPredefined: true,
    },
    {
      id: 'role-teacher',
      code: 'TEACHER',
      name: 'Docente',
      description: null,
      isPredefined: true,
    },
  ];

  function setupMocks() {
    const roleReader: RoleReader = {
      listAll: vi.fn().mockResolvedValue(mockRoles),
      listDetailed: vi.fn().mockResolvedValue([]),
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

  it('maps roles to summaries in response', async () => {
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
});
