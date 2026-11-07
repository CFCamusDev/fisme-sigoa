import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { ProtectedRoleError } from '../../domain/errors/protected-role-error.js';
import { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import { AssignUserRolesUseCase } from '../../application/assign-user-roles.js';
import { UserAccessAssembler } from '../../application/user-access-assembler.js';
import { PrismaUserAccessSubjectRepository } from './prisma-user-access-subject-repository.js';
import { PrismaUserRoleRepository } from './prisma-user-role-repository.js';
import { PrismaUserPermissionRepository } from './prisma-user-permission-repository.js';
import { PrismaRolePermissionRepository } from './prisma-role-permission-repository.js';
import { PrismaRoleRepository } from './prisma-role-repository.js';
import { PrismaGrantReader } from './prisma-grant-reader.js';
import type { AuditLogger } from '../../../../shared/audit/audit-logger.js';
import type { UserAccessSubjectRepository } from '../../domain/ports/user-access-subject-repository.js';

describe('AssignUserRoles concurrency', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('keeps at least one active administrator when two administrators remove each other concurrently', async () => {
    await seedAuthorization(prisma);
    const admin = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    const teacher = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
    const first = await prisma.user.create({
      data: {
        names: 'Prueba',
        firstSurname: 'Uno',
        email: 'admin-one@example.test',
        status: 'ACTIVE',
      },
    });
    const second = await prisma.user.create({
      data: {
        names: 'Prueba',
        firstSurname: 'Dos',
        email: 'admin-two@example.test',
        status: 'ACTIVE',
      },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: first.id, roleId: admin.id },
        { userId: second.id, roleId: admin.id },
      ],
    });
    const uow = new PrismaUnitOfWork(prisma);
    const subject = new PrismaUserAccessSubjectRepository(uow);
    const roles = new PrismaUserRoleRepository(uow);
    const direct = new PrismaUserPermissionRepository(uow);
    const rolePermissions = new PrismaRolePermissionRepository(uow);
    const roleRepository = new PrismaRoleRepository(uow);
    const authorizer = new PermissionAuthorizer({
      findGrantsByUserId: async () => [{ permission: 'usuario.editar', scope: 'GLOBAL' }],
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
    const useCase = new AssignUserRolesUseCase({
      subject: gatedSubject,
      roles,
      roleRepository,
      authorizer,
      assembler,
      unitOfWork: uow,
      auditLogger: createPrismaAuditServices(uow).auditLogger,
    });
    const firstTx = useCase.execute({
      actorId: first.id,
      userId: second.id,
      input: { roleIds: [teacher.id] },
    });
    await ready;
    let secondFinished = false;
    const secondTx = useCase.execute({
      actorId: second.id,
      userId: first.id,
      input: { roleIds: [teacher.id] },
    });
    void secondTx.then(
      () => {
        secondFinished = true;
      },
      () => {
        secondFinished = true;
      },
    );
    const outcomes = Promise.allSettled([firstTx, secondTx]);
    let observedWait = false;
    try {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline && !secondFinished) {
        const waiting = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query LIKE '%FROM roles%FOR UPDATE%'
        `;
        if ((waiting[0]?.count ?? 0n) > 0n) {
          observedWait = true;
          break;
        }
      }
    } finally {
      release();
    }
    const results = await outcomes;
    expect(observedWait).toBe(true);
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.any(ProtectedRoleError),
    });
    expect(
      await prisma.userRole.count({ where: { roleId: admin.id, user: { status: 'ACTIVE' } } }),
    ).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'ROLE_CHANGE', entity: 'User' } })).toBe(
      1,
    );
  });
  async function setup() {
    await seedAuthorization(prisma);
    const administrator = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    const teacher = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
    const member = await prisma.role.findUniqueOrThrow({ where: { code: 'COMMITTEE_MEMBER' } });
    const director = await prisma.role.findUniqueOrThrow({ where: { code: 'PROGRAM_DIRECTOR' } });
    const actor = await prisma.user.create({
      data: {
        names: 'Prueba',
        firstSurname: 'Actor',
        email: 'role-actor@example.test',
        status: 'ACTIVE',
      },
    });
    const user = await prisma.user.create({
      data: {
        names: 'Prueba',
        firstSurname: 'Destino',
        email: 'role-target@example.test',
        status: 'ACTIVE',
      },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: actor.id, roleId: administrator.id },
        { userId: user.id, roleId: teacher.id },
      ],
    });
    const uow = new PrismaUnitOfWork(prisma);
    const subject = new PrismaUserAccessSubjectRepository(uow);
    const roles = new PrismaUserRoleRepository(uow);
    const direct = new PrismaUserPermissionRepository(uow);
    const rolePermissions = new PrismaRolePermissionRepository(uow);
    const roleRepository = new PrismaRoleRepository(uow);
    const authorizer = new PermissionAuthorizer(new PrismaGrantReader(uow));
    const assembler = new UserAccessAssembler({ roles, direct, rolePermissions });
    const auditLogger = createPrismaAuditServices(uow).auditLogger;
    const create = (
      logger: AuditLogger = auditLogger,
      subjectOverride: UserAccessSubjectRepository = subject,
    ) =>
      new AssignUserRolesUseCase({
        subject: subjectOverride,
        roles,
        roleRepository,
        authorizer,
        assembler,
        unitOfWork: uow,
        auditLogger: logger,
      });
    return { actor, user, teacher, member, director, subject, roles, auditLogger, create };
  }

  it('serializes concurrent assignments for the same user and chains audit snapshots', async () => {
    const context = await setup();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let signal = () => {};
    const ready = new Promise<void>((resolve) => {
      signal = resolve;
    });
    let count = 0;
    const gatedSubject = {
      findById: (id: string) => context.subject.findById(id),
      lockForUpdate: async (id: string) => {
        const result = await context.subject.lockForUpdate(id);
        if (++count === 1) {
          signal();
          await gate;
        }
        return result;
      },
    };
    const useCase = context.create(context.auditLogger, gatedSubject);
    const first = useCase.execute({
      actorId: context.actor.id,
      userId: context.user.id,
      input: { roleIds: [context.member.id] },
    });
    await ready;
    let secondFinished = false;
    const second = useCase.execute({
      actorId: context.actor.id,
      userId: context.user.id,
      input: { roleIds: [context.director.id] },
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
            AND query LIKE '%FROM roles%FOR UPDATE%'
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
    expect((await context.roles.findByUserId(context.user.id)).map((role) => role.roleId)).toEqual([
      context.director.id,
    ]);
    const audit = await prisma.auditLog.findMany({
      where: { entity: 'User', entityId: context.user.id, action: 'ROLE_CHANGE' },
      orderBy: { sequence: 'asc' },
    });
    expect(audit.map(({ before, after }) => ({ before, after }))).toEqual([
      {
        before: { roles: [{ id: context.teacher.id, code: context.teacher.code }] },
        after: { roles: [{ id: context.member.id, code: context.member.code }] },
      },
      {
        before: { roles: [{ id: context.member.id, code: context.member.code }] },
        after: { roles: [{ id: context.director.id, code: context.director.code }] },
      },
    ]);
    expect(JSON.stringify(audit.map(({ before, after }) => ({ before, after })))).not.toContain(
      context.user.email,
    );
  });

  it('rolls back when audit fails and does not audit a repeated assignment', async () => {
    const context = await setup();
    const failing = context.create({
      log: async () => {
        throw new Error('audit failed');
      },
    });
    const command = {
      actorId: context.actor.id,
      userId: context.user.id,
      input: { roleIds: [context.member.id] },
    };
    await expect(failing.execute(command)).rejects.toThrow('audit failed');
    expect((await context.roles.findByUserId(context.user.id)).map((role) => role.roleId)).toEqual([
      context.teacher.id,
    ]);
    expect(await prisma.auditLog.count({ where: { entityId: context.user.id } })).toBe(0);
    const useCase = context.create();
    await useCase.execute(command);
    await useCase.execute(command);
    expect(
      await prisma.auditLog.count({ where: { action: 'ROLE_CHANGE', entityId: context.user.id } }),
    ).toBe(1);
  });
});
