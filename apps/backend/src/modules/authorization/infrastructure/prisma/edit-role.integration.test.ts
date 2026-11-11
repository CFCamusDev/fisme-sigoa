import { beforeEach, describe, expect, it } from 'vitest';
import { roleDtoSchema, type UpdateRoleRequest } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { PrismaRoleRepository } from './prisma-role-repository.js';
import { PrismaRoleReader } from './prisma-role-reader.js';
import { PrismaGrantReader } from './prisma-grant-reader.js';
import { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import { EditRoleUseCase } from '../../application/edit-role.js';
import { RoleAlreadyExistsError } from '../../domain/errors/role-already-exists-error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found-error.js';
import { Role } from '../../domain/entities/role.js';

describe('EditRoleUseCase Integration (PostgreSQL real, HU-006, T-006-11, RF-006, RS-002, RS-020, RNF-017)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const roleRepo = new PrismaRoleRepository(uow);
  const roleReader = new PrismaRoleReader(uow);
  const authorizer = new PermissionAuthorizer(new PrismaGrantReader(uow));

  let adminActorId: string;

  beforeEach(async () => {
    await seedAuthorizationFast(prisma);

    const admin = await createAuthenticatedActor({
      prisma,
      roles: ['ADMINISTRATOR'],
    });
    adminActorId = admin.user.id;
  });

  function createUseCase(customAuditLogger = auditServices.auditLogger) {
    return new EditRoleUseCase({
      roleRepository: roleRepo,
      roleReader,
      authorizer,
      unitOfWork: uow,
      auditLogger: customAuditLogger,
    });
  }

  it('updates the role name and description and writes one audit entry', async () => {
    const useCase = createUseCase();
    const suffix = Date.now().toString().slice(-4);
    const initialName = `Rol Inicial ${suffix}`;
    const newName = `Rol Actualizado ${suffix}`;

    const role = Role.create({
      id: `role-edit-${suffix}`,
      name: initialName,
      description: 'Descripción previa',
      createdBy: adminActorId,
    });
    await roleRepo.add(role);

    const input: UpdateRoleRequest = {
      name: newName,
      description: 'Nueva descripción detallada',
    };

    const result = await useCase.execute({
      actorId: adminActorId,
      ip: '192.168.1.50',
      roleId: role.id,
      input,
    });

    const parsedDto = roleDtoSchema.safeParse(result);
    expect(parsedDto.success).toBe(true);
    expect(result.name).toBe(newName);
    expect(result.description).toBe('Nueva descripción detallada');

    // Verificar en BD
    const updatedInDb = await prisma.role.findUniqueOrThrow({
      where: { id: role.id },
    });
    expect(updatedInDb.name).toBe(newName);
    expect(updatedInDb.description).toBe('Nueva descripción detallada');
    expect(updatedInDb.updatedBy).toBe(adminActorId);

    // Verificar auditoría
    const auditEntries = await prisma.auditLog.findMany({
      where: {
        entity: 'Role',
        entityId: role.id,
        action: 'UPDATE',
      },
    });
    expect(auditEntries).toHaveLength(1);
    const audit = auditEntries[0]!;
    expect(audit.actor).toBe(adminActorId);
    expect(audit.ip).toBe('192.168.1.50');
    expect((audit.before as Record<string, unknown>).name).toBe(initialName);
    expect((audit.after as Record<string, unknown>).name).toBe(newName);
  });

  it('updates only the description without modifying the name', async () => {
    const useCase = createUseCase();
    const suffix = Date.now().toString().slice(-4);
    const roleName = `Rol Solo Descripcion ${suffix}`;

    const role = Role.create({
      id: `role-desc-${suffix}`,
      name: roleName,
      description: 'Antes',
      createdBy: adminActorId,
    });
    await roleRepo.add(role);

    const result = await useCase.execute({
      actorId: adminActorId,
      ip: '127.0.0.1',
      roleId: role.id,
      input: { description: 'Después' },
    });

    expect(result.name).toBe(roleName);
    expect(result.description).toBe('Después');

    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(inDb.name).toBe(roleName);
    expect(inDb.description).toBe('Después');
  });

  it('does not save or write audit if no effective changes were made', async () => {
    const useCase = createUseCase();
    const suffix = Date.now().toString().slice(-4);
    const roleName = `Rol Sin Cambios ${suffix}`;

    const role = Role.create({
      id: `role-noop-${suffix}`,
      name: roleName,
      description: 'Misma descripción',
      createdBy: adminActorId,
    });
    await roleRepo.add(role);

    await useCase.execute({
      actorId: adminActorId,
      ip: '127.0.0.1',
      roleId: role.id,
      input: {
        name: roleName,
        description: 'Misma descripción',
      },
    });

    const auditCount = await prisma.auditLog.count({
      where: {
        entity: 'Role',
        entityId: role.id,
        action: 'UPDATE',
      },
    });
    expect(auditCount).toBe(0);
  });

  it('rejects renaming to a name already occupied by another role', async () => {
    const useCase = createUseCase();
    const suffix = Date.now().toString().slice(-4);
    const existingName = `Rol Existente ${suffix}`;

    const existingRole = Role.create({
      id: `role-exist-${suffix}`,
      name: existingName,
      createdBy: adminActorId,
    });
    await roleRepo.add(existingRole);

    const roleToEdit = Role.create({
      id: `role-to-edit-${suffix}`,
      name: `Rol Original ${suffix}`,
      createdBy: adminActorId,
    });
    await roleRepo.add(roleToEdit);

    await expect(
      useCase.execute({
        actorId: adminActorId,
        ip: '127.0.0.1',
        roleId: roleToEdit.id,
        input: { name: existingName },
      }),
    ).rejects.toThrow(RoleAlreadyExistsError);

    // Asegurar que no cambió en BD
    const unchanged = await prisma.role.findUniqueOrThrow({ where: { id: roleToEdit.id } });
    expect(unchanged.name).toBe(`Rol Original ${suffix}`);
  });

  it('throws RoleNotFoundError when the role does not exist', async () => {
    const useCase = createUseCase();

    await expect(
      useCase.execute({
        actorId: adminActorId,
        ip: '127.0.0.1',
        roleId: 'non-existent-role-id',
        input: { name: 'Cualquier Nombre' },
      }),
    ).rejects.toThrow(RoleNotFoundError);
  });

  it('rolls back the update when the audit write fails (atomic UoW)', async () => {
    const suffix = Date.now().toString().slice(-4);
    const role = Role.create({
      id: `role-rollback-${suffix}`,
      name: `Rol Pre-Fallo ${suffix}`,
      description: 'Original',
      createdBy: adminActorId,
    });
    await roleRepo.add(role);

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
        roleId: role.id,
        input: { name: `Rol Post-Fallo ${suffix}` },
      }),
    ).rejects.toThrow('Fallo simulado al registrar auditoría');

    // Comprobar rollback en BD
    const reverted = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(reverted.name).toBe(`Rol Pre-Fallo ${suffix}`);

    const auditCount = await prisma.auditLog.count({
      where: {
        entity: 'Role',
        entityId: role.id,
        action: 'UPDATE',
      },
    });
    expect(auditCount).toBe(0);
  });

  it(
    'only one of two concurrent renames to the same name succeeds',
    { timeout: 20_000 },
    async () => {
      const useCase = createUseCase();
      const suffix = Date.now().toString().slice(-4);
      const targetName = `Nombre Concurrente ${suffix}`;

      const roleA = Role.create({
        id: `role-concurr-a-${suffix}`,
        name: `Rol Concurrente A ${suffix}`,
        createdBy: adminActorId,
      });
      const roleB = Role.create({
        id: `role-concurr-b-${suffix}`,
        name: `Rol Concurrente B ${suffix}`,
        createdBy: adminActorId,
      });
      await roleRepo.add(roleA);
      await roleRepo.add(roleB);

      const [resA, resB] = await Promise.allSettled([
        useCase.execute({
          actorId: adminActorId,
          ip: '127.0.0.1',
          roleId: roleA.id,
          input: { name: targetName },
        }),
        useCase.execute({
          actorId: adminActorId,
          ip: '127.0.0.1',
          roleId: roleB.id,
          input: { name: targetName },
        }),
      ]);

      const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
      const rejected = [resA, resB].filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // Uno tiene éxito y el otro debe fallar con RoleAlreadyExistsError
      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionReason).toBeInstanceOf(RoleAlreadyExistsError);

      // Exactamente un rol en BD tiene ese nombre
      const rolesWithTargetName = await prisma.role.findMany({
        where: { name: targetName },
      });
      expect(rolesWithTargetName).toHaveLength(1);

      // Exactamente una auditoría para ese cambio
      const audits = await prisma.auditLog.findMany({
        where: {
          entity: 'Role',
          action: 'UPDATE',
          entityId: rolesWithTargetName[0]!.id,
        },
      });
      expect(audits).toHaveLength(1);
    },
  );
});
