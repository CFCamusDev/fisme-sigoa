import { describe, expect, it, vi } from 'vitest';
import type { RoleDto, UpdateRolePermissionsRequest } from '@sigoa/shared';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { AuditLogger, AuditEvent } from '../../../shared/audit/audit-logger.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { PermissionRepository } from '../domain/ports/permission-repository.js';
import type { RolePermissionRepository } from '../domain/ports/role-permission-repository.js';
import type { RoleReader } from '../domain/ports/role-reader.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import { RoleNotFoundError } from '../domain/errors/role-not-found-error.js';
import { InvalidRoleDataError } from '../domain/errors/invalid-role-data-error.js';
import { ProtectedRoleError } from '../domain/errors/protected-role-error.js';
import { Role } from '../domain/entities/role.js';
import { EditRolePermissionsUseCase } from './edit-role-permissions.js';

describe('EditRolePermissionsUseCase Unit Tests (HU-006, T-006-25, RF-006, RS-002, RS-020, RNF-017, D5, D6, D10)', () => {
  const actorId = 'actor-admin-123';
  const roleId = 'custom-role-456';

  const initialRole = Role.restore({
    id: roleId,
    code: 'CUSTOM_ROLE',
    name: 'Rol Personalizado',
    description: null,
    status: 'ACTIVE',
    deactivatedAt: null,
    isPredefined: false,
    createdBy: actorId,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const updatedRoleDto: RoleDto = {
    id: roleId,
    code: 'CUSTOM_ROLE',
    name: 'Rol Personalizado',
    description: null,
    isPredefined: false,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 0,
    permissions: [
      {
        permissionCode: 'rol.ver',
        scope: 'GLOBAL',
      },
    ],
    updatedAt: '2026-11-06T19:00:00.000Z',
  };

  function setupMocks(roleInstance: Role | null = initialRole) {
    const roleRepository: RoleRepository = {
      findById: vi.fn().mockResolvedValue(roleInstance),
      findByIdForUpdate: vi.fn().mockResolvedValue(roleInstance),
      findByCode: vi.fn().mockResolvedValue(roleInstance),
      findByName: vi.fn().mockResolvedValue(roleInstance),
      add: vi.fn().mockResolvedValue(undefined),
    };

    const permissionRepository: PermissionRepository = {
      findAll: vi.fn().mockResolvedValue([]),
      findByCodes: vi.fn().mockImplementation(async (codes: string[]) => {
        return codes.map((code) => ({
          id: `perm-${code}`,
          code,
          description: `Desc ${code}`,
          module: 'M01',
        }));
      }),
    };

    const rolePermissionRepository: RolePermissionRepository = {
      findByRoleId: vi.fn().mockResolvedValue([]),
      replaceForRole: vi.fn().mockResolvedValue({ added: 1, updated: 0, removed: 0 }),
    };

    const roleReader: RoleReader = {
      listAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(updatedRoleDto),
    };

    const authorizer = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as PermissionAuthorizer;

    const unitOfWork: UnitOfWork = {
      run: vi.fn().mockImplementation(async (work: () => Promise<unknown>) => await work()),
    };

    const loggedEvents: AuditEvent[] = [];
    const auditLogger: AuditLogger = {
      log: vi.fn().mockImplementation(async (event: AuditEvent) => {
        loggedEvents.push(event);
      }),
    };

    const useCase = new EditRolePermissionsUseCase({
      roleRepository,
      permissionRepository,
      rolePermissionRepository,
      roleReader,
      authorizer,
      unitOfWork,
      auditLogger,
    });

    return {
      useCase,
      roleRepository,
      permissionRepository,
      rolePermissionRepository,
      roleReader,
      authorizer,
      unitOfWork,
      auditLogger,
      loggedEvents,
    };
  }

  it('denies without rol.editar and touches nothing', async () => {
    const { useCase, authorizer, roleRepository, unitOfWork, auditLogger } = setupMocks();
    vi.mocked(authorizer.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('No posee rol.editar'),
    );

    const input: UpdateRolePermissionsRequest = {
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    await expect(useCase.execute({ actorId, roleId, input })).rejects.toThrow(ForbiddenError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(roleRepository.findByIdForUpdate).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('replaces the permission set and audits before and after', async () => {
    const { useCase, rolePermissionRepository, auditLogger, loggedEvents } = setupMocks();
    vi.mocked(rolePermissionRepository.findByRoleId).mockResolvedValueOnce([
      { permissionId: 'perm-old', permissionCode: 'usuario.ver', scope: 'OWN' },
    ]);
    vi.mocked(rolePermissionRepository.replaceForRole).mockResolvedValueOnce({
      added: 1,
      updated: 0,
      removed: 1,
    });

    const input: UpdateRolePermissionsRequest = {
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    const result = await useCase.execute({ actorId, ip: '127.0.0.1', roleId, input });

    expect(rolePermissionRepository.replaceForRole).toHaveBeenCalledWith(
      roleId,
      [{ permissionId: 'perm-rol.ver', scope: 'GLOBAL' }],
      actorId,
    );

    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(loggedEvents[0]).toMatchObject({
      action: 'PERMISSION_CHANGE',
      entity: 'Role',
      entityId: roleId,
      actor: actorId,
      ip: '127.0.0.1',
      before: {
        code: 'CUSTOM_ROLE',
        name: 'Rol Personalizado',
        permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }],
      },
      after: {
        code: 'CUSTOM_ROLE',
        name: 'Rol Personalizado',
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      },
    });

    expect(result).toEqual(updatedRoleDto);
  });

  it('does not write or audit when nothing changes', async () => {
    const { useCase, rolePermissionRepository, auditLogger } = setupMocks();
    vi.mocked(rolePermissionRepository.replaceForRole).mockResolvedValueOnce({
      added: 0,
      updated: 0,
      removed: 0,
    });

    const input: UpdateRolePermissionsRequest = {
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    const result = await useCase.execute({ actorId, roleId, input });

    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(result).toEqual(updatedRoleDto);
  });

  it('fails with not found for an unknown role', async () => {
    const { useCase, roleRepository, rolePermissionRepository } = setupMocks(null);

    const input: UpdateRolePermissionsRequest = {
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    await expect(useCase.execute({ actorId, roleId: 'non-existent', input })).rejects.toThrow(
      RoleNotFoundError,
    );
    expect(roleRepository.findByIdForUpdate).toHaveBeenCalledWith('non-existent');
    expect(rolePermissionRepository.replaceForRole).not.toHaveBeenCalled();
  });

  it('rejects an unknown permission code before opening the transaction', async () => {
    const { useCase, permissionRepository, unitOfWork } = setupMocks();
    vi.mocked(permissionRepository.findByCodes).mockResolvedValueOnce([]); // no existe en catálogo

    const input: UpdateRolePermissionsRequest = {
      permissions: [{ permissionCode: 'codigo.desconocido', scope: 'GLOBAL' }],
    };

    await expect(useCase.execute({ actorId, roleId, input })).rejects.toThrow(InvalidRoleDataError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects repeated codes before opening the transaction', async () => {
    const { useCase, unitOfWork } = setupMocks();

    const input: UpdateRolePermissionsRequest = {
      permissions: [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' },
        { permissionCode: 'rol.ver', scope: 'OWN' },
      ],
    };

    await expect(useCase.execute({ actorId, roleId, input })).rejects.toThrow(InvalidRoleDataError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects removing rol.ver or rol.editar from the administrator role', async () => {
    const adminRole = Role.restore({
      id: 'admin-role-id',
      code: 'ADMINISTRATOR',
      name: 'Administrador',
      description: null,
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: true,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { useCase, rolePermissionRepository } = setupMocks(adminRole);

    const inputWithoutEditar: UpdateRolePermissionsRequest = {
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    await expect(
      useCase.execute({ actorId, roleId: 'admin-role-id', input: inputWithoutEditar }),
    ).rejects.toThrow(ProtectedRoleError);

    expect(rolePermissionRepository.replaceForRole).not.toHaveBeenCalled();
  });

  it('rejects lowering them to own scope for the administrator role', async () => {
    const adminRole = Role.restore({
      id: 'admin-role-id',
      code: 'ADMINISTRATOR',
      name: 'Administrador',
      description: null,
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: true,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { useCase, rolePermissionRepository } = setupMocks(adminRole);

    const inputWithOwnScope: UpdateRolePermissionsRequest = {
      permissions: [
        { permissionCode: 'rol.ver', scope: 'OWN' },
        { permissionCode: 'rol.editar', scope: 'GLOBAL' },
      ],
    };

    await expect(
      useCase.execute({ actorId, roleId: 'admin-role-id', input: inputWithOwnScope }),
    ).rejects.toThrow(ProtectedRoleError);

    expect(rolePermissionRepository.replaceForRole).not.toHaveBeenCalled();
  });

  it('allows editing the rest of the administrator role', async () => {
    const adminRole = Role.restore({
      id: 'admin-role-id',
      code: 'ADMINISTRATOR',
      name: 'Administrador',
      description: null,
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: true,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { useCase, rolePermissionRepository } = setupMocks(adminRole);

    const input: UpdateRolePermissionsRequest = {
      permissions: [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' },
        { permissionCode: 'rol.editar', scope: 'GLOBAL' },
        { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
      ],
    };

    await expect(
      useCase.execute({ actorId, roleId: 'admin-role-id', input }),
    ).resolves.toBeDefined();
    expect(rolePermissionRepository.replaceForRole).toHaveBeenCalled();
  });

  it('allows editing an inactive role', async () => {
    const inactiveRole = Role.restore({
      id: 'inactive-role-id',
      code: 'INACTIVE_ROLE',
      name: 'Rol Inactivo',
      description: null,
      status: 'INACTIVE',
      deactivatedAt: new Date(),
      isPredefined: false,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { useCase, rolePermissionRepository } = setupMocks(inactiveRole);

    const input: UpdateRolePermissionsRequest = {
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    await expect(
      useCase.execute({ actorId, roleId: 'inactive-role-id', input }),
    ).resolves.toBeDefined();
    expect(rolePermissionRepository.replaceForRole).toHaveBeenCalled();
  });

  it('locks the role row before reading its grants', async () => {
    const callOrder: string[] = [];
    const { useCase, roleRepository, rolePermissionRepository } = setupMocks();

    vi.mocked(roleRepository.findByIdForUpdate).mockImplementation(async () => {
      callOrder.push('findByIdForUpdate');
      return initialRole;
    });

    vi.mocked(rolePermissionRepository.findByRoleId).mockImplementation(async () => {
      callOrder.push('findByRoleId');
      return [];
    });

    const input: UpdateRolePermissionsRequest = {
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    await useCase.execute({ actorId, roleId, input });

    expect(callOrder).toEqual(['findByIdForUpdate', 'findByRoleId']);
  });

  it('returns a parsed role dto', async () => {
    const { useCase, roleReader } = setupMocks();

    const input: UpdateRolePermissionsRequest = {
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    const result = await useCase.execute({ actorId, roleId, input });

    expect(roleReader.findById).toHaveBeenCalledWith(roleId);
    expect(result).toEqual(updatedRoleDto);
  });
});
