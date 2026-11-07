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
});
