import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createRoleWithGrants } from '../../../../test/factories/authorization.js';
import { PrismaUserAccessSubjectRepository } from './prisma-user-access-subject-repository.js';
import { PrismaUserRoleRepository } from './prisma-user-role-repository.js';

describe('PrismaUserRoleRepository concurrency', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('serializes concurrent replacements of the same user', async () => {
    const user = await prisma.user.create({
      data: {
        names: 'Prueba',
        firstSurname: 'Usuario',
        email: 'concurrent@example.test',
        status: 'ACTIVE',
      },
    });
    const first = await createRoleWithGrants(prisma, { name: 'Rol concurrente alfa' });
    const second = await createRoleWithGrants(prisma, { name: 'Rol concurrente beta' });
    const uow = new PrismaUnitOfWork(prisma);
    const subject = new PrismaUserAccessSubjectRepository(uow);
    const roles = new PrismaUserRoleRepository(uow);

    let releaseFirst = () => {};
    const firstMayCommit = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstLocked = () => {};
    const firstReady = new Promise<void>((resolve) => {
      firstLocked = resolve;
    });
    const firstTx = uow.run(async () => {
      await subject.lockForUpdate(user.id);
      const before = await roles.findByUserId(user.id);
      firstLocked();
      await firstMayCommit;
      await roles.replaceForUser(user.id, [first.id], user.id);
      return before;
    });
    await firstReady;
    let secondFinished = false;
    const secondTx = uow
      .run(async () => {
        await subject.lockForUpdate(user.id);
        const before = await roles.findByUserId(user.id);
        await roles.replaceForUser(user.id, [second.id], user.id);
        return before;
      })
      .finally(() => {
        secondFinished = true;
      });

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
      releaseFirst();
    }
    const [initial, subsequent] = await Promise.all([firstTx, secondTx]);
    expect(observedWait).toBe(true);
    expect(initial).toEqual([]);
    expect(subsequent.map((row) => row.roleId)).toEqual([first.id]);
    expect((await roles.findByUserId(user.id)).map((row) => row.roleId)).toEqual([second.id]);
  });

  it('reads active and inactive roles in code order', async () => {
    const user = await prisma.user.create({
      data: { names: 'Prueba', firstSurname: 'Usuario', email: 'read@example.test' },
    });
    const active = await createRoleWithGrants(prisma, { name: 'Rol alpha' });
    const inactive = await createRoleWithGrants(prisma, { name: 'Rol beta', status: 'INACTIVE' });
    const roles = new PrismaUserRoleRepository(new PrismaUnitOfWork(prisma));
    expect(await roles.findByUserId(user.id)).toEqual([]);
    await prisma.userRole.createMany({
      data: [
        { userId: user.id, roleId: inactive.id },
        { userId: user.id, roleId: active.id },
      ],
    });
    expect(await roles.findByUserId(user.id)).toEqual([
      { roleId: active.id, roleCode: active.code, roleName: active.name, roleStatus: 'ACTIVE' },
      {
        roleId: inactive.id,
        roleCode: inactive.code,
        roleName: inactive.name,
        roleStatus: 'INACTIVE',
      },
    ]);
  });

  it('replaces the set, tracks the actor and leaves unchanged grants untouched', async () => {
    const user = await prisma.user.create({
      data: { names: 'Prueba', firstSurname: 'Usuario', email: 'replace@example.test' },
    });
    const first = await createRoleWithGrants(prisma, { name: 'Rol primero' });
    const second = await createRoleWithGrants(prisma, { name: 'Rol segundo' });
    const uow = new PrismaUnitOfWork(prisma);
    const roles = new PrismaUserRoleRepository(uow);
    await expect(roles.replaceForUser(user.id, [first.id], 'actor')).rejects.toThrow(
      /transacción activa/,
    );
    expect(await uow.run(() => roles.replaceForUser(user.id, [first.id], 'actor'))).toEqual({
      added: [first.id],
      removed: [],
    });
    const existing = await prisma.userRole.findUniqueOrThrow({
      where: { userId_roleId: { userId: user.id, roleId: first.id } },
    });
    expect(existing.createdBy).toBe('actor');
    expect(existing.updatedBy).toBe('actor');
    expect(await uow.run(() => roles.replaceForUser(user.id, [first.id], 'other'))).toEqual({
      added: [],
      removed: [],
    });
    expect(await prisma.userRole.findUniqueOrThrow({ where: { id: existing.id } })).toEqual(
      existing,
    );
    expect(await uow.run(() => roles.replaceForUser(user.id, [second.id], 'actor'))).toEqual({
      added: [second.id],
      removed: [first.id],
    });
    expect((await roles.findByUserId(user.id)).map(({ roleId }) => roleId)).toEqual([second.id]);
    expect(await uow.run(() => roles.replaceForUser(user.id, [], 'actor'))).toEqual({
      added: [],
      removed: [second.id],
    });
  });

  it('rolls back invalid or aborted replacements and rejects duplicate roles', async () => {
    const user = await prisma.user.create({
      data: { names: 'Prueba', firstSurname: 'Usuario', email: 'rollback@example.test' },
    });
    const first = await createRoleWithGrants(prisma, { name: 'Rol inicial' });
    const second = await createRoleWithGrants(prisma, { name: 'Rol siguiente' });
    const uow = new PrismaUnitOfWork(prisma);
    const roles = new PrismaUserRoleRepository(uow);
    await uow.run(() => roles.replaceForUser(user.id, [first.id], null));
    await expect(
      uow.run(() => roles.replaceForUser(user.id, [second.id, 'missing'], null)),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      uow.run(() => roles.replaceForUser(user.id, [second.id, second.id], null)),
    ).rejects.toThrow(/duplicados/);
    await expect(
      uow.run(async () => {
        await roles.replaceForUser(user.id, [second.id], null);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect((await roles.findByUserId(user.id)).map(({ roleId }) => roleId)).toEqual([first.id]);
  });

  it('counts only other active holders and requires a transaction for locking', async () => {
    const role = await createRoleWithGrants(prisma, { name: 'Rol conteo' });
    const users = await Promise.all(
      (['ACTIVE', 'ACTIVE', 'INACTIVE', 'PENDING_ACTIVATION'] as const).map((status, index) =>
        prisma.user.create({
          data: {
            names: 'Prueba',
            firstSurname: 'Usuario',
            email: `holder${index}@example.test`,
            status,
          },
        }),
      ),
    );
    await prisma.userRole.createMany({
      data: users.map((user) => ({ userId: user.id, roleId: role.id })),
    });
    const uow = new PrismaUnitOfWork(prisma);
    const roles = new PrismaUserRoleRepository(uow);
    const subject = new PrismaUserAccessSubjectRepository(uow);
    expect(await roles.countActiveHolders(role.id, users[0]!.id)).toBe(1);
    expect(await roles.countActiveHolders(role.id, 'missing')).toBe(2);
    await expect(subject.lockForUpdate(users[0]!.id)).rejects.toThrow(/transacción activa/);
    expect(await uow.run(() => subject.lockForUpdate('missing'))).toBeNull();
    expect(await uow.run(() => subject.lockForUpdate(users[0]!.id))).toEqual({
      id: users[0]!.id,
      status: 'ACTIVE',
    });
  });
});
