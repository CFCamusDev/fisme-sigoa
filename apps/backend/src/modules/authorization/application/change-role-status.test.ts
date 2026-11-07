import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleDto } from '@sigoa/shared';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Role } from '../domain/entities/role.js';
import { InvalidRoleStatusTransitionError } from '../domain/errors/invalid-role-status-transition-error.js';
import { ProtectedRoleError } from '../domain/errors/protected-role-error.js';
import { RoleDeactivationRequiresConfirmationError } from '../domain/errors/role-deactivation-requires-confirmation-error.js';
import { RoleNotFoundError } from '../domain/errors/role-not-found-error.js';
import type { RoleReader } from '../domain/ports/role-reader.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import { ChangeRoleStatusUseCase } from './change-role-status.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';

describe('ChangeRoleStatusUseCase Unit Tests (HU-006, T-006-11, CA3, RF-006, RS-002, RS-020)', () => {
  let roleRepository: RoleRepository;
  let roleReader: RoleReader;
  let authorizer: PermissionAuthorizer;
  let unitOfWork: UnitOfWork;
  let auditLogger: AuditLogger;
  let useCase: ChangeRoleStatusUseCase;

  const actorId = 'usr-admin-01';
  const roleId = 'role-evaluator';

  function createRoleDto(overrides: Partial<RoleDto> = {}): RoleDto {
    return {
      id: roleId,
      code: 'EVALUATOR',
      name: 'Evaluador',
      description: 'Rol para evaluar estudiantes',
      isPredefined: false,
      status: 'ACTIVE',
      deactivatedAt: null,
      userCount: 0,
      permissions: [{ permissionCode: 'medicion.ver', scope: 'GLOBAL' }],
      updatedAt: '2026-11-06T12:00:00.000Z',
      ...overrides,
    };
  }

  beforeEach(() => {
    roleRepository = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      findByCode: vi.fn(),
      findByName: vi.fn(),
      add: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };

    roleReader = {
      listAll: vi.fn(),
      findById: vi.fn().mockResolvedValue(createRoleDto()),
    };

    authorizer = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as PermissionAuthorizer;

    unitOfWork = {
      run: vi.fn().mockImplementation(async (work) => work()),
    };

    auditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new ChangeRoleStatusUseCase({
      roleRepository,
      roleReader,
      authorizer,
      unitOfWork,
      auditLogger,
    });
  });

  it('denies without rol.editar and touches nothing', async () => {
    vi.mocked(authorizer.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('No tienes permiso para editar roles'),
    );

    await expect(
      useCase.execute({
        actorId,
        ip: '127.0.0.1',
        roleId,
        input: { status: 'INACTIVE' },
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(authorizer.assertAllowed).toHaveBeenCalledWith({
      actorId,
      permission: 'rol.editar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(roleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('deactivates a role without users without confirmation', async () => {
    const role = Role.create({
      id: roleId,
      name: 'Evaluador',
      description: 'Rol para evaluar',
      createdBy: 'creator-id',
    });
    vi.mocked(roleRepository.findByIdForUpdate).mockResolvedValue(role);
    vi.mocked(roleReader.findById)
      .mockResolvedValueOnce(createRoleDto({ userCount: 0, status: 'ACTIVE' }))
      .mockResolvedValueOnce(createRoleDto({ userCount: 0, status: 'INACTIVE' }));

    const result = await useCase.execute({
      actorId,
      ip: '192.168.1.1',
      roleId,
      input: { status: 'INACTIVE' },
    });

    expect(role.status).toBe('INACTIVE');
    expect(role.deactivatedAt).not.toBeNull();
    expect(role.updatedBy).toBe(actorId);
    expect(roleRepository.save).toHaveBeenCalledWith(role);

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATE_CHANGE',
        entity: 'Role',
        entityId: roleId,
        actor: actorId,
        ip: '192.168.1.1',
        before: expect.objectContaining({ status: 'ACTIVE' }),
        after: expect.objectContaining({ status: 'INACTIVE', userCount: 0 }),
      }),
    );
    expect(result.status).toBe('INACTIVE');
  });

  it('requires confirmation when the role has users and changes nothing', async () => {
    const role = Role.create({
      id: roleId,
      name: 'Evaluador',
      description: 'Rol para evaluar',
      createdBy: 'creator-id',
    });
    vi.mocked(roleRepository.findByIdForUpdate).mockResolvedValue(role);
    vi.mocked(roleReader.findById).mockResolvedValue(
      createRoleDto({ userCount: 5, status: 'ACTIVE' }),
    );

    const errorPromise = useCase.execute({
      actorId,
      ip: '127.0.0.1',
      roleId,
      input: { status: 'INACTIVE' },
    });

    await expect(errorPromise).rejects.toThrow(RoleDeactivationRequiresConfirmationError);
    await expect(errorPromise).rejects.toMatchObject({
      userCount: 5,
      message: 'El rol está asignado a 5 usuario(s). Confirma para desactivarlo.',
    });

    expect(role.status).toBe('ACTIVE');
    expect(roleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('deactivates with confirmation and audits the user count', async () => {
    const role = Role.create({
      id: roleId,
      name: 'Evaluador',
      description: 'Rol para evaluar',
      createdBy: 'creator-id',
    });
    vi.mocked(roleRepository.findByIdForUpdate).mockResolvedValue(role);
    vi.mocked(roleReader.findById)
      .mockResolvedValueOnce(createRoleDto({ userCount: 5, status: 'ACTIVE' }))
      .mockResolvedValueOnce(createRoleDto({ userCount: 5, status: 'INACTIVE' }));

    const result = await useCase.execute({
      actorId,
      ip: '127.0.0.1',
      roleId,
      input: { status: 'INACTIVE', confirmed: true },
    });

    expect(role.status).toBe('INACTIVE');
    expect(roleRepository.save).toHaveBeenCalledWith(role);

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATE_CHANGE',
        entity: 'Role',
        entityId: roleId,
        actor: actorId,
        after: expect.objectContaining({ status: 'INACTIVE', userCount: 5 }),
      }),
    );
    expect(result.status).toBe('INACTIVE');
  });

  it('reactivates without confirmation', async () => {
    const role = Role.restore({
      id: roleId,
      code: 'EVALUATOR',
      name: 'Evaluador',
      description: null,
      status: 'INACTIVE',
      deactivatedAt: new Date(),
      isPredefined: false,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(roleRepository.findByIdForUpdate).mockResolvedValue(role);
    vi.mocked(roleReader.findById).mockResolvedValue(
      createRoleDto({ userCount: 3, status: 'ACTIVE' }),
    );

    const result = await useCase.execute({
      actorId,
      ip: '127.0.0.1',
      roleId,
      input: { status: 'ACTIVE' },
    });

    expect(role.status).toBe('ACTIVE');
    expect(role.deactivatedAt).toBeNull();
    expect(roleRepository.save).toHaveBeenCalledWith(role);

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATE_CHANGE',
        entity: 'Role',
        entityId: roleId,
        actor: actorId,
        before: expect.objectContaining({ status: 'INACTIVE' }),
        after: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(result.status).toBe('ACTIVE');
  });

  it('rejects deactivating the administrator role', async () => {
    const adminRole = Role.restore({
      id: 'role-admin',
      code: 'ADMINISTRATOR',
      name: 'Administrador',
      description: 'Rol del administrador',
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: true,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(roleRepository.findByIdForUpdate).mockResolvedValue(adminRole);

    await expect(
      useCase.execute({
        actorId,
        ip: '127.0.0.1',
        roleId: 'role-admin',
        input: { status: 'INACTIVE', confirmed: true },
      }),
    ).rejects.toThrow(ProtectedRoleError);

    expect(adminRole.status).toBe('ACTIVE');
    expect(roleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects repeating the current status', async () => {
    const role = Role.create({
      id: roleId,
      name: 'Evaluador',
      createdBy: 'creator-id',
    });
    vi.mocked(roleRepository.findByIdForUpdate).mockResolvedValue(role);

    await expect(
      useCase.execute({
        actorId,
        ip: '127.0.0.1',
        roleId,
        input: { status: 'ACTIVE' },
      }),
    ).rejects.toThrow(InvalidRoleStatusTransitionError);

    expect(roleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails with not found for an unknown role', async () => {
    vi.mocked(roleRepository.findByIdForUpdate).mockResolvedValue(null);

    await expect(
      useCase.execute({
        actorId,
        ip: '127.0.0.1',
        roleId: 'unknown-role',
        input: { status: 'INACTIVE' },
      }),
    ).rejects.toThrow(RoleNotFoundError);

    expect(roleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('returns a parsed role dto', async () => {
    const role = Role.create({
      id: roleId,
      name: 'Evaluador',
      createdBy: 'creator-id',
    });
    vi.mocked(roleRepository.findByIdForUpdate).mockResolvedValue(role);
    const expectedDto = createRoleDto({ status: 'INACTIVE' });
    vi.mocked(roleReader.findById).mockResolvedValue(expectedDto);

    const result = await useCase.execute({
      actorId,
      ip: '127.0.0.1',
      roleId,
      input: { status: 'INACTIVE', confirmed: true },
    });

    expect(result).toEqual(expectedDto);
  });
});
