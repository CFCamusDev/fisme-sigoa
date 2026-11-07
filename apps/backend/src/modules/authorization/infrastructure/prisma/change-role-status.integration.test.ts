import { beforeEach, describe, expect, it } from 'vitest';
import { roleDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import {
  createRoleWithGrants,
  grantRole,
  seedAuthorization,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { PrismaRoleRepository } from './prisma-role-repository.js';
import { PrismaRoleReader } from './prisma-role-reader.js';
import { PrismaGrantReader } from './prisma-grant-reader.js';
import { PrismaPermissionRepository } from './prisma-permission-repository.js';
import { PrismaRolePermissionRepository } from './prisma-role-permission-repository.js';
import { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import { ChangeRoleStatusUseCase } from '../../application/change-role-status.js';
import { EditRolePermissionsUseCase } from '../../application/edit-role-permissions.js';
import { InvalidRoleStatusTransitionError } from '../../domain/errors/invalid-role-status-transition-error.js';
import { RoleDeactivationRequiresConfirmationError } from '../../domain/errors/role-deactivation-requires-confirmation-error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found-error.js';
import { ProtectedRoleError } from '../../domain/errors/protected-role-error.js';

describe('ChangeRoleStatusUseCase Integration (PostgreSQL real, HU-006, T-006-11, CA3, RF-006, RS-002, RS-020, RNF-017)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const roleRepo = new PrismaRoleRepository(uow);
  const roleReader = new PrismaRoleReader(uow);
  const authorizer = new PermissionAuthorizer(new PrismaGrantReader(uow));
  const permissionRepo = new PrismaPermissionRepository(uow);
  const rolePermissionRepo = new PrismaRolePermissionRepository(uow);

  let adminActorId: string;

  beforeEach(async () => {
    await seedAuthorization(prisma);

    const admin = await createAuthenticatedActor({
      prisma,
      roles: ['ADMINISTRATOR'],
    });
    adminActorId = admin.user.id;
  });

  function createUseCase(customAuditLogger = auditServices.auditLogger) {
    return new ChangeRoleStatusUseCase({
      roleRepository: roleRepo,
      roleReader,
      authorizer,
      unitOfWork: uow,
      auditLogger: customAuditLogger,
    });
  }

  function createEditPermissionsUseCase() {
    return new EditRolePermissionsUseCase({
      roleRepository: roleRepo,
      permissionRepository: permissionRepo,
      rolePermissionRepository: rolePermissionRepo,
      roleReader,
      authorizer,
      unitOfWork: uow,
      auditLogger: auditServices.auditLogger,
    });
  }

  it('deactivates a role without users without requiring confirmation', async () => {
    const useCase = createUseCase();
    const suffix = Date.now().toString().slice(-4);
    const created = await createRoleWithGrants(prisma, {
      name: `Rol Sin Usuarios ${suffix}`,
    });

    const result = await useCase.execute({
      actorId: adminActorId,
      ip: '192.168.1.10',
      roleId: created.id,
      input: { status: 'INACTIVE' },
    });

    const parsed = roleDtoSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.status).toBe('INACTIVE');
    expect(result.deactivatedAt).not.toBeNull();

    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.status).toBe('INACTIVE');
    expect(inDb.deactivatedAt).not.toBeNull();
    expect(inDb.updatedBy).toBe(adminActorId);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        entity: 'Role',
        entityId: created.id,
        action: 'STATE_CHANGE',
      },
    });
    expect(audit.actor).toBe(adminActorId);
    expect((audit.after as Record<string, unknown>).status).toBe('INACTIVE');
    expect((audit.after as Record<string, unknown>).userCount).toBe(0);
  });

  it('requires confirmation when users are assigned and leaves role ACTIVE without audit', async () => {
    const useCase = createUseCase();
    const suffix = Date.now().toString().slice(-4);
    const created = await createRoleWithGrants(prisma, {
      name: `Rol Con Usuario ${suffix}`,
    });

    // Asignar el rol al usuario admin
    await grantRole(prisma, adminActorId, created.code);

    await expect(
      useCase.execute({
        actorId: adminActorId,
        ip: '127.0.0.1',
        roleId: created.id,
        input: { status: 'INACTIVE' },
      }),
    ).rejects.toThrow(RoleDeactivationRequiresConfirmationError);

    // Comprobar que en BD sigue ACTIVE
    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.status).toBe('ACTIVE');
    expect(inDb.deactivatedAt).toBeNull();

    // Sin auditoría
    const auditCount = await prisma.auditLog.count({
      where: {
        entity: 'Role',
        entityId: created.id,
        action: 'STATE_CHANGE',
      },
    });
    expect(auditCount).toBe(0);
  });

  it('deactivates the role, keeps its assignments and audits once with userCount', async () => {
    const useCase = createUseCase();
    const suffix = Date.now().toString().slice(-4);
    const created = await createRoleWithGrants(prisma, {
      name: `Rol Con Asignaciones ${suffix}`,
    });

    // Asignar a dos usuarios
    const user2 = await createAuthenticatedActor({ prisma, roles: [] });
    await grantRole(prisma, adminActorId, created.code);
    await grantRole(prisma, user2.user.id, created.code);

    const result = await useCase.execute({
      actorId: adminActorId,
      ip: '10.0.0.1',
      roleId: created.id,
      input: { status: 'INACTIVE', confirmed: true },
    });

    expect(result.status).toBe('INACTIVE');
    expect(result.userCount).toBe(2);

    // Asignaciones siguen intactas en user_roles
    const assignments = await prisma.userRole.findMany({
      where: { roleId: created.id },
    });
    expect(assignments).toHaveLength(2);

    // Auditoría registrada con userCount = 2
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        entity: 'Role',
        entityId: created.id,
        action: 'STATE_CHANGE',
      },
    });
    expect((audit.after as Record<string, unknown>).userCount).toBe(2);
  });

  it('reactivates an inactive role without requiring confirmation', async () => {
    const useCase = createUseCase();
    const suffix = Date.now().toString().slice(-4);
    const created = await createRoleWithGrants(prisma, {
      name: `Rol Inactivo ${suffix}`,
      status: 'INACTIVE',
    });

    const result = await useCase.execute({
      actorId: adminActorId,
      ip: '127.0.0.1',
      roleId: created.id,
      input: { status: 'ACTIVE' },
    });

    expect(result.status).toBe('ACTIVE');
    expect(result.deactivatedAt).toBeNull();

    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.status).toBe('ACTIVE');
    expect(inDb.deactivatedAt).toBeNull();
  });

  it('rejects deactivating the administrator role', async () => {
    const useCase = createUseCase();
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });

    await expect(
      useCase.execute({
        actorId: adminActorId,
        ip: '127.0.0.1',
        roleId: adminRole.id,
        input: { status: 'INACTIVE', confirmed: true },
      }),
    ).rejects.toThrow(ProtectedRoleError);

    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: adminRole.id } });
    expect(inDb.status).toBe('ACTIVE');
  });

  it('rejects repeating current status with InvalidRoleStatusTransitionError', async () => {
    const useCase = createUseCase();
    const suffix = Date.now().toString().slice(-4);
    const created = await createRoleWithGrants(prisma, {
      name: `Rol Repetir ${suffix}`,
      status: 'ACTIVE',
    });

    await expect(
      useCase.execute({
        actorId: adminActorId,
        ip: '127.0.0.1',
        roleId: created.id,
        input: { status: 'ACTIVE' },
      }),
    ).rejects.toThrow(InvalidRoleStatusTransitionError);
  });

  it('throws RoleNotFoundError for non existent role', async () => {
    const useCase = createUseCase();

    await expect(
      useCase.execute({
        actorId: adminActorId,
        ip: '127.0.0.1',
        roleId: 'non-existent-role-id',
        input: { status: 'INACTIVE' },
      }),
    ).rejects.toThrow(RoleNotFoundError);
  });

  it('rolls back the status change when the audit write fails (atomic UoW)', async () => {
    const suffix = Date.now().toString().slice(-4);
    const created = await createRoleWithGrants(prisma, {
      name: `Rol Rollback Status ${suffix}`,
    });

    const failingAuditLogger = {
      log: async () => {
        throw new Error('Fallo simulado al registrar auditoría');
      },
    };
    const useCase = createUseCase(failingAuditLogger);

    await expect(
      useCase.execute({
        actorId: adminActorId,
        ip: '127.0.0.1',
        roleId: created.id,
        input: { status: 'INACTIVE' },
      }),
    ).rejects.toThrow('Fallo simulado al registrar auditoría');

    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.status).toBe('ACTIVE');
    expect(inDb.deactivatedAt).toBeNull();

    const auditCount = await prisma.auditLog.count({
      where: {
        entity: 'Role',
        entityId: created.id,
        action: 'STATE_CHANGE',
      },
    });
    expect(auditCount).toBe(0);
  });

  it(
    'only one of N concurrent deactivations succeeds and audits once',
    { timeout: 20_000 },
    async () => {
      const useCase = createUseCase();
      const suffix = Date.now().toString().slice(-4);
      const created = await createRoleWithGrants(prisma, {
        name: `Rol Concurrente Desactivar ${suffix}`,
      });

      const N = 5;
      const promises = Array.from({ length: N }, () =>
        useCase
          .execute({
            actorId: adminActorId,
            ip: '127.0.0.1',
            roleId: created.id,
            input: { status: 'INACTIVE' },
          })
          .then((res) => ({ status: 'fulfilled' as const, value: res }))
          .catch((err) => ({ status: 'rejected' as const, reason: err })),
      );

      const results = await Promise.all(promises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactamente una ejecución triunfa
      expect(fulfilled).toHaveLength(1);
      // Las N-1 restantes deben fallar con InvalidRoleStatusTransitionError
      expect(rejected).toHaveLength(N - 1);
      for (const rej of rejected) {
        expect((rej as { reason: unknown }).reason).toBeInstanceOf(
          InvalidRoleStatusTransitionError,
        );
      }

      // En BD el rol queda INACTIVE
      const inDb = await prisma.role.findUniqueOrThrow({ where: { id: created.id } });
      expect(inDb.status).toBe('INACTIVE');

      // Exactamente una entrada de auditoría STATE_CHANGE
      const audits = await prisma.auditLog.findMany({
        where: {
          entity: 'Role',
          entityId: created.id,
          action: 'STATE_CHANGE',
        },
      });
      expect(audits).toHaveLength(1);
    },
  );

  it(
    'serializes a deactivation and a permission edit on the same role',
    { timeout: 20_000 },
    async () => {
      const changeStatusUseCase = createUseCase();
      const editPermsUseCase = createEditPermissionsUseCase();

      const suffix = Date.now().toString().slice(-4);
      const created = await createRoleWithGrants(prisma, {
        name: `Rol Serializado ${suffix}`,
        grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      });

      const [resStatus, resPerms] = await Promise.allSettled([
        changeStatusUseCase.execute({
          actorId: adminActorId,
          ip: '127.0.0.1',
          roleId: created.id,
          input: { status: 'INACTIVE' },
        }),
        editPermsUseCase.execute({
          actorId: adminActorId,
          ip: '127.0.0.1',
          roleId: created.id,
          input: {
            permissions: [{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }],
          },
        }),
      ]);

      // Ambas operaciones concurrentes con findByIdForUpdate deben terminar satisfactoriamente
      expect(resStatus.status).toBe('fulfilled');
      expect(resPerms.status).toBe('fulfilled');

      // El rol quedó INACTIVE y con el permiso 'usuario.ver'
      const inDb = await prisma.role.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      });
      expect(inDb.status).toBe('INACTIVE');
      expect(inDb.rolePermissions).toHaveLength(1);
      expect(inDb.rolePermissions[0]!.permission.code).toBe('usuario.ver');
    },
  );
});
