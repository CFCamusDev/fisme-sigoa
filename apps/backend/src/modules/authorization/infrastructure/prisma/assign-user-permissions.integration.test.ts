import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import { AssignUserPermissionsUseCase } from '../../application/assign-user-permissions.js';
import { UserAccessAssembler } from '../../application/user-access-assembler.js';
import { PrismaUserAccessSubjectRepository } from './prisma-user-access-subject-repository.js';
import { PrismaUserRoleRepository } from './prisma-user-role-repository.js';
import { PrismaUserPermissionRepository } from './prisma-user-permission-repository.js';
import { PrismaRolePermissionRepository } from './prisma-role-permission-repository.js';
import { PrismaPermissionRepository } from './prisma-permission-repository.js';
import { PrismaGrantReader } from './prisma-grant-reader.js';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';
import type { AuditLogger } from '../../../../shared/audit/audit-logger.js';
import { ZodError } from 'zod';
import { userAccessSchema } from '@sigoa/shared';

describe('AssignUserPermissions transactions', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  async function setup() {
    await seedAuthorization(prisma);
    const administrator = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    const actor = await prisma.user.create({
      data: {
        names: 'Prueba',
        firstSurname: 'Actor',
        email: 'permission-actor@example.test',
        status: 'ACTIVE',
      },
    });
    const user = await prisma.user.create({
      data: {
        names: 'Prueba',
        firstSurname: 'Destino',
        email: 'permission-target@example.test',
        status: 'ACTIVE',
      },
    });
    await prisma.userRole.create({ data: { userId: actor.id, roleId: administrator.id } });
    const uow = new PrismaUnitOfWork(prisma);
    const subject = new PrismaUserAccessSubjectRepository(uow);
    const roles = new PrismaUserRoleRepository(uow);
    const direct = new PrismaUserPermissionRepository(uow);
    const rolePermissions = new PrismaRolePermissionRepository(uow);
    const permissionRepository = new PrismaPermissionRepository(uow);
    const authorizer = new PermissionAuthorizer(new PrismaGrantReader(uow));
    const assembler = new UserAccessAssembler({ roles, direct, rolePermissions });
    const auditLogger = createPrismaAuditServices(uow).auditLogger;
    const create = (logger: AuditLogger = auditLogger) =>
      new AssignUserPermissionsUseCase({
        subject,
        direct,
        permissionRepository,
        authorizer,
        assembler,
        unitOfWork: uow,
        auditLogger: logger,
        permissionCache: { invalidateUser: () => {}, invalidateAll: () => {} },
      });
    return { actor, user, direct, authorizer, create };
  }

  it('applies direct OWN access, audits once and removes access on an empty replacement', async () => {
    const { actor, user, direct, authorizer, create } = await setup();
    const assignmentGrants = await prisma.rolePermission.findMany({
      where: { permission: { code: 'permiso.asignar' } },
      select: { scope: true, role: { select: { code: true } } },
    });
    expect(assignmentGrants.map(({ role, scope }) => ({ code: role.code, scope }))).toEqual([
      { code: 'ADMINISTRATOR', scope: 'GLOBAL' },
    ]);
    const useCase = create();
    const command = {
      actorId: actor.id,
      userId: user.id,
      input: { permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' as const }] },
    };
    const result = await useCase.execute(command);
    expect(userAccessSchema.parse(result)).toEqual(result);
    expect(result.roles).toEqual([]);
    expect(result.directPermissions).toEqual([{ permissionCode: 'usuario.ver', scope: 'OWN' }]);
    expect(result.effectivePermissions).toEqual([
      { permissionCode: 'usuario.ver', scope: 'OWN', sources: [{ kind: 'DIRECT', scope: 'OWN' }] },
    ]);
    await expect(
      authorizer.assertAllowed({ actorId: user.id, permission: 'usuario.ver', scope: 'OWN' }),
    ).resolves.toBeUndefined();
    await expect(
      authorizer.assertAllowed({ actorId: user.id, permission: 'usuario.ver', scope: 'GLOBAL' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await useCase.execute(command);
    const audit = await prisma.auditLog.findMany({
      where: { action: 'PERMISSION_CHANGE', entityId: user.id },
    });
    expect(audit.map(({ before, after }) => ({ before, after }))).toEqual([
      {
        before: { permissions: [] },
        after: { permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }] },
      },
    ]);
    expect(JSON.stringify(audit[0]?.after)).not.toContain(user.email);
    await useCase.execute({ actorId: actor.id, userId: user.id, input: { permissions: [] } });
    expect(await direct.findByUserId(user.id)).toEqual([]);
    await expect(
      authorizer.assertAllowed({ actorId: user.id, permission: 'usuario.ver', scope: 'OWN' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rolls back direct grants when the audit logger fails', async () => {
    const { actor, user, direct, create } = await setup();
    const useCase = create({
      log: async () => {
        throw new Error('audit failed');
      },
    });
    await expect(
      useCase.execute({
        actorId: actor.id,
        userId: user.id,
        input: { permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }] },
      }),
    ).rejects.toThrow('audit failed');
    expect(await direct.findByUserId(user.id)).toEqual([]);
    expect(await prisma.auditLog.count({ where: { entityId: user.id } })).toBe(0);
  });

  it('rolls back the change if the response cannot be parsed', async () => {
    const { actor, user, direct, create } = await setup();
    const invalidRole = await prisma.role.create({
      data: { code: '', name: 'Rol de prueba sin código' },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: invalidRole.id } });
    await expect(
      create().execute({
        actorId: actor.id,
        userId: user.id,
        input: { permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }] },
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await direct.findByUserId(user.id)).toEqual([]);
    expect(await prisma.auditLog.count({ where: { entityId: user.id } })).toBe(0);
  });

  it('serializes concurrent replacements for the same user', async () => {
    await seedAuthorization(prisma);
    const user = await prisma.user.create({
      data: {
        names: 'Prueba',
        firstSurname: 'Usuario',
        email: 'concurrent-grants@example.test',
        status: 'ACTIVE',
      },
    });
    const initial = await prisma.permission.findUniqueOrThrow({ where: { code: 'usuario.ver' } });
    await prisma.userPermission.create({
      data: { userId: user.id, permissionId: initial.id, scope: 'OWN' },
    });
    const uow = new PrismaUnitOfWork(prisma);
    const subject = new PrismaUserAccessSubjectRepository(uow);
    const roles = new PrismaUserRoleRepository(uow);
    const direct = new PrismaUserPermissionRepository(uow);
    const rolePermissions = new PrismaRolePermissionRepository(uow);
    const permissionRepository = new PrismaPermissionRepository(uow);
    const authorizer = new PermissionAuthorizer({
      findGrantsByUserId: async () => [{ permission: 'permiso.asignar', scope: 'GLOBAL' }],
    });
    const assembler = new UserAccessAssembler({ roles, direct, rolePermissions });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let signal = () => {};
    const ready = new Promise<void>((resolve) => {
      signal = resolve;
    });
    let calls = 0;
    const gatedSubject = {
      findById: (id: string) => subject.findById(id),
      lockForUpdate: async (id: string) => {
        const result = await subject.lockForUpdate(id);
        if (++calls === 1) {
          signal();
          await gate;
        }
        return result;
      },
    };
    const useCase = new AssignUserPermissionsUseCase({
      subject: gatedSubject,
      direct,
      permissionRepository,
      authorizer,
      assembler,
      unitOfWork: uow,
      auditLogger: createPrismaAuditServices(uow).auditLogger,
      permissionCache: { invalidateUser: () => {}, invalidateAll: () => {} },
    });
    const first = useCase.execute({
      actorId: 'actor',
      userId: user.id,
      input: { permissions: [{ permissionCode: 'rol.ver', scope: 'OWN' }] },
    });
    await ready;
    let secondFinished = false;
    const second = useCase.execute({
      actorId: 'actor',
      userId: user.id,
      input: { permissions: [{ permissionCode: 'catalogo.ver', scope: 'GLOBAL' }] },
    });
    void second.then(
      () => {
        secondFinished = true;
      },
      () => {
        secondFinished = true;
      },
    );
    const outcomes = Promise.all([first, second]);
    let observedWait = false;
    try {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline && !secondFinished) {
        const waiting = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query LIKE '%FROM users WHERE id =%FOR UPDATE%'
        `;
        if ((waiting[0]?.count ?? 0n) > 0n) {
          observedWait = true;
          break;
        }
      }
    } finally {
      release();
    }
    await outcomes;
    expect(observedWait).toBe(true);
    expect(
      (await direct.findByUserId(user.id)).map(({ permissionCode, scope }) => ({
        permissionCode,
        scope,
      })),
    ).toEqual([{ permissionCode: 'catalogo.ver', scope: 'GLOBAL' }]);
    const audit = await prisma.auditLog.findMany({
      where: { action: 'PERMISSION_CHANGE', entity: 'User', entityId: user.id },
      orderBy: { sequence: 'asc' },
    });
    expect(audit.map(({ before, after }) => ({ before, after }))).toEqual([
      {
        before: { permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }] },
        after: { permissions: [{ permissionCode: 'rol.ver', scope: 'OWN' }] },
      },
      {
        before: { permissions: [{ permissionCode: 'rol.ver', scope: 'OWN' }] },
        after: { permissions: [{ permissionCode: 'catalogo.ver', scope: 'GLOBAL' }] },
      },
    ]);
  });
});
