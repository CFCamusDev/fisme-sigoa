import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUserAccessSubjectRepository } from './prisma-user-access-subject-repository.js';
import { PrismaUserPermissionRepository } from './prisma-user-permission-repository.js';

describe('PrismaUserPermissionRepository concurrency', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('serializes concurrent replacements of the same user', async () => {
    const user = await prisma.user.create({
      data: { names: 'Prueba', firstSurname: 'Usuario', email: 'grants-concurrent@example.test' },
    });
    const first = await prisma.permission.create({
      data: { code: 'prueba.primero', description: 'Prueba uno', module: 'Prueba' },
    });
    const second = await prisma.permission.create({
      data: { code: 'prueba.segundo', description: 'Prueba dos', module: 'Prueba' },
    });
    const uow = new PrismaUnitOfWork(prisma);
    const subject = new PrismaUserAccessSubjectRepository(uow);
    const grants = new PrismaUserPermissionRepository(uow);
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
      const before = await grants.findByUserId(user.id);
      firstLocked();
      await firstMayCommit;
      await grants.replaceForUser(user.id, [{ permissionId: first.id, scope: 'OWN' }], user.id);
      return before;
    });
    await firstReady;
    let secondFinished = false;
    const secondTx = uow
      .run(async () => {
        await subject.lockForUpdate(user.id);
        const before = await grants.findByUserId(user.id);
        await grants.replaceForUser(
          user.id,
          [{ permissionId: second.id, scope: 'GLOBAL' }],
          user.id,
        );
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
    expect(subsequent.map((row) => row.permissionId)).toEqual([first.id]);
    expect((await grants.findByUserId(user.id)).map((row) => row.permissionId)).toEqual([
      second.id,
    ]);
  });

  it('reads ordered grants and applies minimal changes with actor tracking', async () => {
    const user = await prisma.user.create({
      data: { names: 'Prueba', firstSurname: 'Usuario', email: 'grants-read@example.test' },
    });
    const alpha = await prisma.permission.create({
      data: { code: 'prueba.alfa', description: 'Prueba alfa', module: 'Prueba' },
    });
    const beta = await prisma.permission.create({
      data: { code: 'prueba.beta', description: 'Prueba beta', module: 'Prueba' },
    });
    const uow = new PrismaUnitOfWork(prisma);
    const grants = new PrismaUserPermissionRepository(uow);
    expect(await grants.findByUserId(user.id)).toEqual([]);
    await expect(grants.replaceForUser(user.id, [], 'actor')).rejects.toThrow(/transacción activa/);
    expect(
      await uow.run(() =>
        grants.replaceForUser(
          user.id,
          [
            { permissionId: beta.id, scope: 'OWN' },
            { permissionId: alpha.id, scope: 'GLOBAL' },
          ],
          'actor',
        ),
      ),
    ).toEqual({ added: 2, updated: 0, removed: 0 });
    expect(await grants.findByUserId(user.id)).toEqual([
      { permissionId: alpha.id, permissionCode: alpha.code, scope: 'GLOBAL' },
      { permissionId: beta.id, permissionCode: beta.code, scope: 'OWN' },
    ]);
    const before = await prisma.userPermission.findMany({
      where: { userId: user.id },
      orderBy: { permissionId: 'asc' },
    });
    expect(before.map((grant) => [grant.createdBy, grant.updatedBy])).toEqual([
      ['actor', 'actor'],
      ['actor', 'actor'],
    ]);
    expect(
      await uow.run(() =>
        grants.replaceForUser(
          user.id,
          [
            { permissionId: alpha.id, scope: 'GLOBAL' },
            { permissionId: beta.id, scope: 'OWN' },
          ],
          'other',
        ),
      ),
    ).toEqual({ added: 0, updated: 0, removed: 0 });
    expect(
      await prisma.userPermission.findMany({
        where: { userId: user.id },
        orderBy: { permissionId: 'asc' },
      }),
    ).toEqual(before);
    expect(
      await uow.run(() =>
        grants.replaceForUser(user.id, [{ permissionId: alpha.id, scope: 'OWN' }], 'other'),
      ),
    ).toEqual({ added: 0, updated: 1, removed: 1 });
    expect(
      await prisma.userPermission.findUniqueOrThrow({
        where: { userId_permissionId: { userId: user.id, permissionId: alpha.id } },
      }),
    ).toMatchObject({ scope: 'OWN', createdBy: 'actor', updatedBy: 'other' });
    expect(await uow.run(() => grants.replaceForUser(user.id, [], 'other'))).toEqual({
      added: 0,
      updated: 0,
      removed: 1,
    });
    expect(await grants.findByUserId(user.id)).toEqual([]);
  });

  it('rejects invalid replacements and preserves grants on rollback', async () => {
    const user = await prisma.user.create({
      data: { names: 'Prueba', firstSurname: 'Usuario', email: 'grants-rollback@example.test' },
    });
    const alpha = await prisma.permission.create({
      data: { code: 'prueba.alfa', description: 'Prueba alfa', module: 'Prueba' },
    });
    const beta = await prisma.permission.create({
      data: { code: 'prueba.beta', description: 'Prueba beta', module: 'Prueba' },
    });
    const uow = new PrismaUnitOfWork(prisma);
    const grants = new PrismaUserPermissionRepository(uow);
    await uow.run(() =>
      grants.replaceForUser(user.id, [{ permissionId: alpha.id, scope: 'OWN' }], null),
    );
    await expect(
      uow.run(() =>
        grants.replaceForUser(
          user.id,
          [
            { permissionId: beta.id, scope: 'OWN' },
            { permissionId: 'missing', scope: 'GLOBAL' },
          ],
          null,
        ),
      ),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      uow.run(() =>
        grants.replaceForUser(
          user.id,
          [
            { permissionId: beta.id, scope: 'OWN' },
            { permissionId: beta.id, scope: 'GLOBAL' },
          ],
          null,
        ),
      ),
    ).rejects.toThrow(/duplicados/);
    await expect(
      uow.run(() =>
        grants.replaceForUser(
          user.id,
          [{ permissionId: alpha.id, scope: 'INVALID' as 'OWN' }],
          null,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      uow.run(async () => {
        await grants.replaceForUser(user.id, [{ permissionId: beta.id, scope: 'GLOBAL' }], null);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await grants.findByUserId(user.id)).toEqual([
      { permissionId: alpha.id, permissionCode: alpha.code, scope: 'OWN' },
    ]);
    await expect(prisma.permission.delete({ where: { id: alpha.id } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });
});
