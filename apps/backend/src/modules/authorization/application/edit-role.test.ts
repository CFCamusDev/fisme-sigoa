import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Role } from '../domain/entities/role.js';
import { RoleAlreadyExistsError } from '../domain/errors/role-already-exists-error.js';
import { RoleNotFoundError } from '../domain/errors/role-not-found-error.js';
import type { RoleReader } from '../domain/ports/role-reader.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import { EditRoleUseCase } from './edit-role.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';

describe('EditRoleUseCase (HU-006, N2c, T-006-11, RF-006, RS-002, RS-020, D10)', () => {
  const dummyActorId = 'admin-actor-uuid';
  const roleId = 'role-cuid-edit-test';

  let initialRole: Role;
  let mockRoleDto: RoleDto;

  beforeEach(() => {
    initialRole = Role.create({
      id: roleId,
      name: 'Coordinador de Escuela',
      description: 'Coordinación académica',
      createdBy: 'system',
    });

    mockRoleDto = {
      id: roleId,
      code: 'COORDINADOR_DE_ESCUELA',
      name: 'Coordinador de Escuela Modificado',
      description: 'Nueva descripción',
      isPredefined: false,
      status: 'ACTIVE',
      deactivatedAt: null,
      userCount: 3,
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      updatedAt: '2026-11-06T20:00:00.000Z',
    };
  });

  function setupUseCase(options?: {
    allowed?: boolean;
    role?: Role | null;
    otherRoleWithSameName?: Role | null;
  }) {
    const roleInstance = options?.role !== undefined ? options.role : initialRole;

    const authorizer: PermissionAuthorizer = {
      assertAllowed: vi.fn().mockImplementation(async () => {
        if (options?.allowed === false) {
          throw new ForbiddenError('No tienes permiso para editar roles.');
        }
      }),
    } as unknown as PermissionAuthorizer;

    const roleRepository: RoleRepository = {
      findById: vi.fn().mockResolvedValue(roleInstance),
      findByIdForUpdate: vi.fn().mockResolvedValue(roleInstance),
      findByCode: vi.fn().mockResolvedValue(roleInstance),
      findByName: vi.fn().mockImplementation(async (name: string) => {
        if (options?.otherRoleWithSameName) {
          return options.otherRoleWithSameName;
        }
        if (roleInstance && roleInstance.name.toLowerCase() === name.trim().toLowerCase()) {
          return roleInstance;
        }
        return null;
      }),
      add: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const roleReader: RoleReader = {
      findById: vi.fn().mockResolvedValue(mockRoleDto),
      listAll: vi.fn().mockResolvedValue([]),
    };

    const auditLogger: AuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    const unitOfWork: UnitOfWork = {
      run: vi.fn().mockImplementation(async (work) => work()),
    };

    const useCase = new EditRoleUseCase({
      roleRepository,
      roleReader,
      authorizer,
      unitOfWork,
      auditLogger,
    });

    return {
      useCase,
      authorizer,
      roleRepository,
      roleReader,
      auditLogger,
      unitOfWork,
      roleInstance,
    };
  }

  it('denies without rol.editar and touches nothing', async () => {
    const { useCase, authorizer, roleRepository, auditLogger } = setupUseCase({
      allowed: false,
    });

    await expect(
      useCase.execute({
        actorId: dummyActorId,
        roleId,
        input: { name: 'Nuevo Nombre' },
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(authorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: dummyActorId,
      permission: 'rol.editar',
      scope: 'GLOBAL',
    });
    expect(roleRepository.findByIdForUpdate).not.toHaveBeenCalled();
    expect(roleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('renames a role and audits before and after', async () => {
    const { useCase, roleRepository, auditLogger, roleReader } = setupUseCase();

    const result = await useCase.execute({
      actorId: dummyActorId,
      ip: '192.168.1.1',
      roleId,
      input: {
        name: 'Coordinador de Escuela Modificado',
        description: 'Nueva descripción',
      },
    });

    expect(roleRepository.findByIdForUpdate).toHaveBeenCalledWith(roleId);
    expect(roleRepository.save).toHaveBeenCalledOnce();

    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'UPDATE',
      entity: 'Role',
      entityId: roleId,
      actor: dummyActorId,
      ip: '192.168.1.1',
      before: expect.objectContaining({
        name: 'Coordinador de Escuela',
        description: 'Coordinación académica',
      }),
      after: expect.objectContaining({
        name: 'Coordinador de Escuela Modificado',
        description: 'Nueva descripción',
      }),
    });

    expect(roleReader.findById).toHaveBeenCalledWith(roleId);
    expect(result).toEqual(mockRoleDto);
  });

  it('clears the description', async () => {
    const { useCase, roleRepository, auditLogger, roleInstance } = setupUseCase();

    await useCase.execute({
      actorId: dummyActorId,
      roleId,
      input: { description: null },
    });

    expect(roleInstance?.description).toBeNull();
    expect(roleRepository.save).toHaveBeenCalledOnce();
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.objectContaining({ description: 'Coordinación académica' }),
        after: expect.objectContaining({ description: null }),
      }),
    );
  });

  it('does not write or audit when nothing changes', async () => {
    const { useCase, roleRepository, auditLogger } = setupUseCase();

    await useCase.execute({
      actorId: dummyActorId,
      roleId,
      input: {
        name: 'Coordinador de Escuela',
        description: 'Coordinación académica',
      },
    });

    expect(roleRepository.findByIdForUpdate).toHaveBeenCalledWith(roleId);
    expect(roleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a name used by another role ignoring case', async () => {
    const otherRole = Role.create({
      id: 'other-role-uuid',
      name: 'Auditor de Sistemas',
    });

    const { useCase, roleRepository, auditLogger } = setupUseCase({
      otherRoleWithSameName: otherRole,
    });

    await expect(
      useCase.execute({
        actorId: dummyActorId,
        roleId,
        input: { name: 'auditor de sistemas' },
      }),
    ).rejects.toThrow(RoleAlreadyExistsError);

    expect(roleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('allows keeping the same name with different case', async () => {
    const { useCase, roleRepository, auditLogger, roleInstance } = setupUseCase();

    await useCase.execute({
      actorId: dummyActorId,
      roleId,
      input: { name: 'COORDINADOR DE ESCUELA' },
    });

    expect(roleInstance?.name).toBe('COORDINADOR DE ESCUELA');
    expect(roleRepository.save).toHaveBeenCalledOnce();
    expect(auditLogger.log).toHaveBeenCalledOnce();
  });

  it('fails with not found for an unknown role', async () => {
    const { useCase, roleRepository, auditLogger } = setupUseCase({ role: null });

    await expect(
      useCase.execute({
        actorId: dummyActorId,
        roleId: 'non-existent-id',
        input: { name: 'Nuevo Nombre' },
      }),
    ).rejects.toThrow(RoleNotFoundError);

    expect(roleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('locks the role row before reading (findByIdForUpdate)', async () => {
    const { useCase, roleRepository, unitOfWork } = setupUseCase();

    await useCase.execute({
      actorId: dummyActorId,
      roleId,
      input: { name: 'Nombre Actualizado' },
    });

    expect(unitOfWork.run).toHaveBeenCalledOnce();
    expect(roleRepository.findByIdForUpdate).toHaveBeenCalledWith(roleId);
  });

  it('renames a predefined role (D10)', async () => {
    const predefinedRole = Role.restore({
      id: 'predefined-teacher-id',
      code: 'TEACHER',
      name: 'Docente',
      description: 'Docente original',
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: true,
      createdBy: 'seed',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { useCase, roleRepository, auditLogger } = setupUseCase({
      role: predefinedRole,
    });

    await useCase.execute({
      actorId: dummyActorId,
      roleId: 'predefined-teacher-id',
      input: { name: 'Profesor de EPIS' },
    });

    expect(predefinedRole.name).toBe('Profesor de EPIS');
    expect(predefinedRole.code).toBe('TEACHER'); // El código no cambia
    expect(roleRepository.save).toHaveBeenCalledOnce();
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.objectContaining({ name: 'Docente', isPredefined: true }),
        after: expect.objectContaining({ name: 'Profesor de EPIS', isPredefined: true }),
      }),
    );
  });

  it('returns a parsed role dto', async () => {
    const { useCase } = setupUseCase();

    const result = await useCase.execute({
      actorId: dummyActorId,
      roleId,
      input: { name: 'Coordinador de Escuela Modificado' },
    });

    expect(result.id).toBe(roleId);
    expect(result.name).toBe('Coordinador de Escuela Modificado');
    expect(result.userCount).toBe(3);
  });
});
