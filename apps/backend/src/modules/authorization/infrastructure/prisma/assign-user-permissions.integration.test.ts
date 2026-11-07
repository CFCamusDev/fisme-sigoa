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

describe('AssignUserPermissions transactions', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

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
