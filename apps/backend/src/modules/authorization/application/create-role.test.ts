import { describe, expect, it, vi } from 'vitest';
import type { RoleDto, CreateRoleRequest } from '@sigoa/shared';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { AuditLogger, AuditEvent } from '../../../shared/audit/audit-logger.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { PermissionRepository } from '../domain/ports/permission-repository.js';
import type { RolePermissionRepository } from '../domain/ports/role-permission-repository.js';
import type { RoleReader } from '../domain/ports/role-reader.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import { InvalidRoleDataError } from '../domain/errors/invalid-role-data-error.js';
import { RoleAlreadyExistsError } from '../domain/errors/role-already-exists-error.js';
import { Role } from '../domain/entities/role.js';
import { CreateRoleUseCase } from './create-role.js';

describe('CreateRoleUseCase Unit Tests (HU-006, T-006-24, RF-006, RS-002, RS-020, RNF-017)', () => {
  const actorId = 'actor-uuid-123';
  const roleId = 'role-uuid-456';

  const sampleRoleDto: RoleDto = {
    id: roleId,
    code: 'AUDITOR_DE_CALIDAD',
    name: 'Auditor de Calidad',
    description: 'Rol para auditorías de calidad',
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
    updatedAt: '2026-11-06T18:00:00.000Z',
  };

  function setupMocks() {
    const roleRepository: RoleRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findByIdForUpdate: vi.fn().mockResolvedValue(null),
      findByCode: vi.fn().mockResolvedValue(null),
      findByName: vi.fn().mockResolvedValue(null),
      add: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
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
      findById: vi.fn().mockResolvedValue(sampleRoleDto),
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

    const useCase = new CreateRoleUseCase({
      roleRepository,
      permissionRepository,
      rolePermissionRepository,
      roleReader,
      authorizer,
      unitOfWork,
      auditLogger,
      idGenerator: () => roleId,
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

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: null,
      permissions: [],
    };

    await expect(useCase.execute({ actorId, input })).rejects.toThrow(ForbiddenError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(roleRepository.add).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('creates a role with a derived code and no permissions', async () => {
    const { useCase, roleRepository, rolePermissionRepository, auditLogger, loggedEvents } =
      setupMocks();

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: 'Sin permisos iniciales',
      permissions: [],
    };

    const result = await useCase.execute({ actorId, ip: '127.0.0.1', input });

    expect(roleRepository.add).toHaveBeenCalledTimes(1);
    const addedRole = vi.mocked(roleRepository.add).mock.calls[0]?.[0];
    expect(addedRole).toBeDefined();
    expect(addedRole?.id).toBe(roleId);
    expect(addedRole?.code).toBe('AUDITOR_DE_CALIDAD');
    expect(addedRole?.name).toBe('Auditor de Calidad');
    expect(addedRole?.status).toBe('ACTIVE');
    expect(addedRole?.isPredefined).toBe(false);

    expect(rolePermissionRepository.replaceForRole).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(loggedEvents[0]?.action).toBe('CREATE');
    expect(loggedEvents[0]?.entity).toBe('Role');
    expect(loggedEvents[0]?.entityId).toBe(roleId);
    expect(loggedEvents[0]?.actor).toBe(actorId);
    expect(loggedEvents[0]?.ip).toBe('127.0.0.1');

    expect(result).toEqual(sampleRoleDto);
  });

  it('creates a role with initial permissions', async () => {
    const { useCase, permissionRepository, rolePermissionRepository, loggedEvents } = setupMocks();

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: null,
      permissions: [
        {
          permissionCode: 'rol.ver',
          scope: 'GLOBAL',
        },
      ],
    };

    await useCase.execute({ actorId, input });

    expect(permissionRepository.findByCodes).toHaveBeenCalledWith(['rol.ver']);
    expect(rolePermissionRepository.replaceForRole).toHaveBeenCalledWith(
      roleId,
      [
        {
          permissionId: 'perm-rol.ver',
          scope: 'GLOBAL',
        },
      ],
      actorId,
    );

    expect(loggedEvents[0]?.after).toEqual(
      expect.objectContaining({
        code: 'AUDITOR_DE_CALIDAD',
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      }),
    );
  });

  it('rejects an unknown permission code before opening the transaction', async () => {
    const { useCase, permissionRepository, unitOfWork } = setupMocks();
    vi.mocked(permissionRepository.findByCodes).mockResolvedValueOnce([]); // no existe en catálogo

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: null,
      permissions: [
        {
          permissionCode: 'permiso.inexistente',
          scope: 'GLOBAL',
        },
      ],
    };

    await expect(useCase.execute({ actorId, input })).rejects.toThrow(InvalidRoleDataError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects repeated permission codes before opening the transaction', async () => {
    const { useCase, unitOfWork } = setupMocks();

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: null,
      permissions: [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' },
        { permissionCode: 'rol.ver', scope: 'OWN' },
      ],
    };

    await expect(useCase.execute({ actorId, input })).rejects.toThrow(InvalidRoleDataError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects a duplicated name', async () => {
    const { useCase, roleRepository } = setupMocks();
    const existing = Role.restore({
      id: 'existing-id',
      code: 'EXISTING',
      name: 'Auditor de Calidad',
      description: null,
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: false,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(roleRepository.findByName).mockResolvedValueOnce(existing);

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: null,
      permissions: [],
    };

    await expect(useCase.execute({ actorId, input })).rejects.toThrow(RoleAlreadyExistsError);
    expect(roleRepository.add).not.toHaveBeenCalled();
  });

  it('rejects a duplicated code', async () => {
    const { useCase, roleRepository } = setupMocks();
    const existing = Role.restore({
      id: 'existing-id',
      code: 'AUDITOR_DE_CALIDAD',
      name: 'Auditor Diferente',
      description: null,
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: false,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(roleRepository.findByCode).mockResolvedValueOnce(existing);

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: null,
      permissions: [],
    };

    await expect(useCase.execute({ actorId, input })).rejects.toThrow(RoleAlreadyExistsError);
    expect(roleRepository.add).not.toHaveBeenCalled();
  });

  it('rejects a name equal to a predefined one ignoring case', async () => {
    const { useCase, roleRepository } = setupMocks();
    const existing = Role.restore({
      id: 'admin-id',
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
    vi.mocked(roleRepository.findByName).mockResolvedValueOnce(existing);

    const input: CreateRoleRequest = {
      name: 'administrador',
      description: null,
      permissions: [],
    };

    await expect(useCase.execute({ actorId, input })).rejects.toThrow(RoleAlreadyExistsError);
    expect(roleRepository.add).not.toHaveBeenCalled();
  });

  it('audits the creation inside the transaction with the after snapshot', async () => {
    const { useCase, auditLogger, loggedEvents } = setupMocks();

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: 'Auditoría interna',
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    await useCase.execute({ actorId, ip: '10.0.0.1', input });

    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(loggedEvents[0]).toMatchObject({
      action: 'CREATE',
      entity: 'Role',
      entityId: roleId,
      actor: actorId,
      ip: '10.0.0.1',
      after: {
        id: roleId,
        code: 'AUDITOR_DE_CALIDAD',
        name: 'Auditor de Calidad',
        description: 'Auditoría interna',
        status: 'ACTIVE',
        isPredefined: false,
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      },
    });
  });

  it('does not audit when the creation fails', async () => {
    const { useCase, roleRepository, auditLogger } = setupMocks();
    vi.mocked(roleRepository.add).mockRejectedValueOnce(new Error('DB failure'));

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: null,
      permissions: [],
    };

    await expect(useCase.execute({ actorId, input })).rejects.toThrow('DB failure');
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('returns a parsed role dto', async () => {
    const { useCase, roleReader } = setupMocks();

    const input: CreateRoleRequest = {
      name: 'Auditor de Calidad',
      description: null,
      permissions: [],
    };

    const result = await useCase.execute({ actorId, input });

    expect(roleReader.findById).toHaveBeenCalledWith(roleId);
    expect(result).toEqual(sampleRoleDto);
  });
});
