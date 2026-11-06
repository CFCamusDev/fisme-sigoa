import { beforeEach, describe, expect, it } from 'vitest';
import { roleDtoSchema, type UpdateRolePermissionsRequest } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { PrismaRoleRepository } from './prisma-role-repository.js';
import { PrismaPermissionRepository } from './prisma-permission-repository.js';
import { PrismaRolePermissionRepository } from './prisma-role-permission-repository.js';
import { PrismaRoleReader } from './prisma-role-reader.js';
import { PrismaGrantReader } from './prisma-grant-reader.js';
import { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import { EditRolePermissionsUseCase } from '../../application/edit-role-permissions.js';

describe('EditRolePermissionsUseCase Integration (PostgreSQL real, HU-006, T-006-11, CA2, RF-006, RS-002, RS-020, RNF-017, D5)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const roleRepo = new PrismaRoleRepository(uow);
  const permissionRepo = new PrismaPermissionRepository(uow);
  const rolePermissionRepo = new PrismaRolePermissionRepository(uow);
  const roleReader = new PrismaRoleReader(uow);
  const grantReader = new PrismaGrantReader(uow);
  const authorizer = new PermissionAuthorizer(grantReader);

  let adminActorId: string;
  let customRoleId: string;

  beforeEach(async () => {
    await seedAuthorization(prisma);

    const admin = await createAuthenticatedActor({
      prisma,
      roles: ['ADMINISTRATOR'],
    });
    adminActorId = admin.user.id;

    const uniqueSuffix = `${Date.now()}_${Math.random()}`;
    const customRole = await prisma.role.create({
      data: {
        code: `ROL_CUSTOM_${uniqueSuffix.replace('.', '_')}`.slice(0, 30),
        name: `Rol Personalizado ${uniqueSuffix}`.slice(0, 50),
        description: 'Rol para pruebas de integración de edición',
        isPredefined: false,
        status: 'ACTIVE',
        createdBy: adminActorId,
      },
    });
    customRoleId = customRole.id;
  });

  function createUseCase(customAuditLogger = auditServices.auditLogger) {
    return new EditRolePermissionsUseCase({
      roleRepository: roleRepo,
      permissionRepository: permissionRepo,
      rolePermissionRepository: rolePermissionRepo,
      roleReader,
      authorizer,
      unitOfWork: uow,
      auditLogger: customAuditLogger,
    });
  }

  it('applies the new permissions on the next authorization check', async () => {
    const useCase = createUseCase();

    // Creamos un usuario de prueba asignado al customRole
    const targetUser = await prisma.user.create({
      data: {
        email: `target_${Date.now()}_${Math.random()}@unterm.edu.pe`,
        names: 'Docente',
        firstSurname: 'Prueba',
        dni: null,
        passwordHash: 'dummy',
        status: 'ACTIVE',
      },
    });
    await prisma.userRole.create({
      data: {
        userId: targetUser.id,
        roleId: customRoleId,
      },
    });

    // Antes de la edición: no tiene usuario.ver
    await expect(
      authorizer.assertAllowed({
        actorId: targetUser.id,
        permission: 'usuario.ver',
        scope: 'GLOBAL',
      }),
    ).rejects.toThrow('No tienes permiso para realizar esta acción.');

    // Editamos permisos del customRole para concederle usuario.ver
    const input: UpdateRolePermissionsRequest = {
      permissions: [
        {
          permissionCode: 'usuario.ver',
          scope: 'GLOBAL',
        },
      ],
    };

    const result = await useCase.execute({
      actorId: adminActorId,
      ip: '10.0.0.5',
      roleId: customRoleId,
      input,
    });

    const parsed = roleDtoSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.permissions).toEqual([
      {
        permissionCode: 'usuario.ver',
        scope: 'GLOBAL',
      },
    ]);

    // En la siguiente comprobación: el usuario ahora tiene el permiso aplicado (CA2)
    await expect(
      authorizer.assertAllowed({
        actorId: targetUser.id,
        permission: 'usuario.ver',
        scope: 'GLOBAL',
      }),
    ).resolves.toBeUndefined();
  });

  it('rolls back the grants when the audit write fails', async () => {
    const failingAuditLogger = {
      log: async () => {
        throw new Error('Fallo simulado de auditoría en edición');
      },
    };
    const useCase = createUseCase(failingAuditLogger);

    const input: UpdateRolePermissionsRequest = {
      permissions: [
        {
          permissionCode: 'usuario.ver',
          scope: 'GLOBAL',
        },
      ],
    };

    await expect(
      useCase.execute({
        actorId: adminActorId,
        roleId: customRoleId,
        input,
      }),
    ).rejects.toThrow('Fallo simulado de auditoría en edición');

    // No debe haber quedado ninguna concesión en BD para ese rol
    const grantsInDb = await prisma.rolePermission.findMany({
      where: { roleId: customRoleId },
    });
    expect(grantsInDb).toHaveLength(0);
  });

  it('does not audit an identical repetition (idempotence D5)', async () => {
    const useCase = createUseCase();

    const input: UpdateRolePermissionsRequest = {
      permissions: [
        {
          permissionCode: 'usuario.ver',
          scope: 'GLOBAL',
        },
      ],
    };

    // Primera ejecución (aplica cambio)
    await useCase.execute({
      actorId: adminActorId,
      roleId: customRoleId,
      input,
    });

    const countBeforeSecond = await prisma.auditLog.count({
      where: {
        entity: 'Role',
        entityId: customRoleId,
        action: 'PERMISSION_CHANGE',
      },
    });
    expect(countBeforeSecond).toBe(1);

    // Segunda ejecución idéntica
    const secondResult = await useCase.execute({
      actorId: adminActorId,
      roleId: customRoleId,
      input,
    });
    expect(secondResult.permissions).toEqual([
      {
        permissionCode: 'usuario.ver',
        scope: 'GLOBAL',
      },
    ]);

    const countAfterSecond = await prisma.auditLog.count({
      where: {
        entity: 'Role',
        entityId: customRoleId,
        action: 'PERMISSION_CHANGE',
      },
    });
    // No debe haberse escrito una segunda entrada de auditoría
    expect(countAfterSecond).toBe(1);
  });

  it('accepts an empty permission list for a custom role', async () => {
    const useCase = createUseCase();

    // Primero asignamos un permiso
    await useCase.execute({
      actorId: adminActorId,
      roleId: customRoleId,
      input: {
        permissions: [{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }],
      },
    });

    // Luego vaciamos la lista de permisos
    const result = await useCase.execute({
      actorId: adminActorId,
      roleId: customRoleId,
      input: {
        permissions: [],
      },
    });

    expect(result.permissions).toEqual([]);

    const grantsInDb = await prisma.rolePermission.findMany({
      where: { roleId: customRoleId },
    });
    expect(grantsInDb).toHaveLength(0);
  });

  it(
    'serializes two concurrent edits and chains their audit entries',
    { timeout: 20_000 },
    async () => {
      const useCase = createUseCase();

      // Edición A: otorga rol.ver
      const inputA: UpdateRolePermissionsRequest = {
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      };
      // Edición B: otorga usuario.ver
      const inputB: UpdateRolePermissionsRequest = {
        permissions: [{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }],
      };

      const [resA, resB] = await Promise.all([
        useCase.execute({ actorId: adminActorId, roleId: customRoleId, input: inputA }),
        useCase.execute({ actorId: adminActorId, roleId: customRoleId, input: inputB }),
      ]);

      expect(resA).toBeDefined();
      expect(resB).toBeDefined();

      const auditEntries = await prisma.auditLog.findMany({
        where: {
          entity: 'Role',
          entityId: customRoleId,
          action: 'PERMISSION_CHANGE',
        },
        orderBy: { id: 'asc' },
      });

      expect(auditEntries).toHaveLength(2);

      // Comprobamos el encadenamiento coherente:
      // El 'before' de la segunda entrada coincide con el 'after' de la primera
      const firstEntry = auditEntries[0]!;
      const secondEntry = auditEntries[1]!;

      expect(secondEntry.before).toEqual(firstEntry.after);
    },
  );
});
