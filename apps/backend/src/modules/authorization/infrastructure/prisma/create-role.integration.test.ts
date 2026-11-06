import { beforeEach, describe, expect, it } from 'vitest';
import { roleDtoSchema, type CreateRoleRequest } from '@sigoa/shared';
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
import { CreateRoleUseCase } from '../../application/create-role.js';
import { RoleAlreadyExistsError } from '../../domain/errors/role-already-exists-error.js';

describe('CreateRoleUseCase Integration (PostgreSQL real, HU-006, T-006-10, CA1, RF-006, RS-002, RS-020, RNF-017)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const roleRepo = new PrismaRoleRepository(uow);
  const permissionRepo = new PrismaPermissionRepository(uow);
  const rolePermissionRepo = new PrismaRolePermissionRepository(uow);
  const roleReader = new PrismaRoleReader(uow);
  const authorizer = new PermissionAuthorizer(new PrismaGrantReader(uow));

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
    return new CreateRoleUseCase({
      roleRepository: roleRepo,
      permissionRepository: permissionRepo,
      rolePermissionRepository: rolePermissionRepo,
      roleReader,
      authorizer,
      unitOfWork: uow,
      auditLogger: customAuditLogger,
    });
  }

  it('creates the role, its permissions and one audit entry', async () => {
    const useCase = createUseCase();
    const uniqueSuffix = Date.now().toString().slice(-4);
    const roleName = `Auditor de Calidad ${uniqueSuffix}`;

    const input: CreateRoleRequest = {
      name: roleName,
      description: 'Rol para auditorías del sistema',
      permissions: [
        {
          permissionCode: 'rol.ver',
          scope: 'GLOBAL',
        },
      ],
    };

    const result = await useCase.execute({
      actorId: adminActorId,
      ip: '192.168.1.100',
      input,
    });

    // Validar DTO devuelto
    const parsedDto = roleDtoSchema.safeParse(result);
    expect(parsedDto.success).toBe(true);
    expect(result.name).toBe(roleName);
    expect(result.status).toBe('ACTIVE');
    expect(result.isPredefined).toBe(false);
    expect(result.userCount).toBe(0);
    expect(result.permissions).toEqual([
      {
        permissionCode: 'rol.ver',
        scope: 'GLOBAL',
      },
    ]);

    // Verificar en BD
    const dbRole = await prisma.role.findUnique({
      where: { id: result.id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
    expect(dbRole).not.toBeNull();
    expect(dbRole?.name).toBe(roleName);
    expect(dbRole?.rolePermissions).toHaveLength(1);
    expect(dbRole?.rolePermissions[0]?.permission.code).toBe('rol.ver');

    // Verificar auditoría
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        entity: 'Role',
        entityId: result.id,
        action: 'CREATE',
      },
    });
    expect(auditRecord).not.toBeNull();
    expect(auditRecord?.actor).toBe(adminActorId);
    expect(auditRecord?.ip).toBe('192.168.1.100');
    expect(auditRecord?.before).toBeNull();
    expect(auditRecord?.after).toMatchObject({
      id: result.id,
      name: roleName,
      code: result.code,
      status: 'ACTIVE',
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });
  });

  it('rolls back the role and its permissions when the audit write fails', async () => {
    const failingAuditLogger = {
      log: async () => {
        throw new Error('Fallo simulado en la escritura de auditoría');
      },
    };
    const useCase = createUseCase(failingAuditLogger);
    const uniqueSuffix = Date.now().toString().slice(-4);
    const roleName = `Rol No Persistido ${uniqueSuffix}`;

    const input: CreateRoleRequest = {
      name: roleName,
      description: 'Debe fallar y hacer rollback completo',
      permissions: [
        {
          permissionCode: 'rol.ver',
          scope: 'GLOBAL',
        },
      ],
    };

    await expect(
      useCase.execute({
        actorId: adminActorId,
        input,
      }),
    ).rejects.toThrow('Fallo simulado en la escritura de auditoría');

    // Comprobar que no quedó rastro en la base de datos
    const dbRole = await prisma.role.findFirst({
      where: { name: roleName },
    });
    expect(dbRole).toBeNull();

    const auditCount = await prisma.auditLog.count({
      where: {
        entity: 'Role',
        action: 'CREATE',
        after: {
          path: ['name'],
          equals: roleName,
        },
      },
    });
    expect(auditCount).toBe(0);
  });

  it(
    'only one of N concurrent creations of the same role succeeds and audits once',
    { timeout: 20_000 },
    async () => {
      const useCase = createUseCase();
      const uniqueSuffix = Date.now().toString().slice(-4);
      const roleName = `Rol Concurrente ${uniqueSuffix}`;

      const input: CreateRoleRequest = {
        name: roleName,
        description: 'Prueba de concurrencia N=5',
        permissions: [
          {
            permissionCode: 'rol.ver',
            scope: 'GLOBAL',
          },
        ],
      };

      const N = 5;
      const promises = Array.from({ length: N }, () =>
        useCase
          .execute({
            actorId: adminActorId,
            ip: '127.0.0.1',
            input,
          })
          .then((res) => ({ status: 'fulfilled' as const, value: res }))
          .catch((err) => ({ status: 'rejected' as const, reason: err })),
      );

      const results = await Promise.all(promises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactamente una ejecución debe tener éxito
      expect(fulfilled).toHaveLength(1);
      // Las N-1 restantes deben fallar con RoleAlreadyExistsError
      expect(rejected).toHaveLength(N - 1);
      for (const rej of rejected) {
        expect((rej as { reason: unknown }).reason).toBeInstanceOf(RoleAlreadyExistsError);
      }

      // Exactamente un rol en BD
      const createdRoles = await prisma.role.findMany({
        where: { name: roleName },
      });
      expect(createdRoles).toHaveLength(1);

      // Exactamente una entrada de auditoría
      const auditEntries = await prisma.auditLog.findMany({
        where: {
          entity: 'Role',
          entityId: createdRoles[0]!.id,
          action: 'CREATE',
        },
      });
      expect(auditEntries).toHaveLength(1);
    },
  );
});
