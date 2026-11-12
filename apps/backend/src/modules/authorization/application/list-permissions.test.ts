import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { PermissionRepository } from '../domain/ports/permission-repository.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import { ListPermissionsUseCase } from './list-permissions.js';

describe('ListPermissionsUseCase (T-006-18a, D3, D7, RS-002, RNF-009)', () => {
  const dummyActorId = 'actor-uuid-123';

  function setupUseCase(options?: {
    allowed?: boolean;
    permissions?: Array<{ id: string; code: string; description: string; module: string }>;
  }) {
    const authorizer: PermissionAuthorizer = {
      assertAllowed: vi.fn().mockImplementation(async () => {
        if (options?.allowed === false) {
          throw new ForbiddenError('No tienes permiso para ver los roles.');
        }
      }),
    } as unknown as PermissionAuthorizer;

    const permissionRepository: PermissionRepository = {
      findAll: vi.fn().mockResolvedValue(
        options?.permissions ?? [
          {
            id: 'perm-1',
            code: 'catalogo.ver',
            description: 'Ver catálogos del programa',
            module: 'CATALOGO',
          },
          {
            id: 'perm-2',
            code: 'rol.ver',
            description: 'Ver roles y permisos',
            module: 'ROLES',
          },
        ],
      ),
      findByCodes: vi.fn(),
    };

    const useCase = new ListPermissionsUseCase({
      permissionRepository,
      authorizer,
    });

    return { useCase, authorizer, permissionRepository };
  }

  it('denies without rol.ver and reads nothing', async () => {
    const { useCase, authorizer, permissionRepository } = setupUseCase({ allowed: false });

    await expect(useCase.execute({ actorId: dummyActorId })).rejects.toThrow(ForbiddenError);

    expect(authorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: dummyActorId,
      permission: 'rol.ver',
      scope: 'GLOBAL',
    });
    expect(permissionRepository.findAll).not.toHaveBeenCalled();
  });

  it('maps the catalog to permission dtos', async () => {
    const { useCase, authorizer, permissionRepository } = setupUseCase({ allowed: true });

    const result = await useCase.execute({ actorId: dummyActorId });

    expect(authorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: dummyActorId,
      permission: 'rol.ver',
      scope: 'GLOBAL',
    });
    expect(permissionRepository.findAll).toHaveBeenCalledOnce();

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      code: 'catalogo.ver',
      description: 'Ver catálogos del programa',
      module: 'CATALOGO',
    });
    expect(result.items[1]).toEqual({
      code: 'rol.ver',
      description: 'Ver roles y permisos',
      module: 'ROLES',
    });
  });

  it('returns an empty list when repository returns no permissions', async () => {
    const { useCase, permissionRepository } = setupUseCase({
      allowed: true,
      permissions: [],
    });

    const result = await useCase.execute({ actorId: dummyActorId });

    expect(permissionRepository.findAll).toHaveBeenCalledOnce();
    expect(result.items).toEqual([]);
  });

  it('rejects a malformed repository result instead of responding', async () => {
    const { useCase } = setupUseCase({
      allowed: true,
      permissions: [
        {
          id: 'invalid',
          code: '', // código vacío no cumple con el esquema
          description: 'desc',
          module: 'MOD',
        },
      ],
    });

    await expect(useCase.execute({ actorId: dummyActorId })).rejects.toThrow();
  });
});
