import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import {
  createRoleWithGrants,
  seedAuthorization,
} from '../../../../test/factories/authorization.js';
import { PrismaUserAccessSubjectRepository } from './prisma-user-access-subject-repository.js';
import { PrismaUserRoleRepository } from './prisma-user-role-repository.js';

describe('PrismaUserRoleRepository concurrency', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('serializes concurrent replacements of the same user', async () => {
    await seedAuthorization(prisma);
    const actor = await createAuthenticatedActor({ prisma, roles: [] });
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
      await subject.lockForUpdate(actor.user.id);
      const before = await roles.findByUserId(actor.user.id);
      firstLocked();
      await firstMayCommit;
      await roles.replaceForUser(actor.user.id, [first.id], actor.user.id);
      return before;
    });
    await firstReady;
    let secondFinished = false;
    const secondTx = uow
      .run(async () => {
        await subject.lockForUpdate(actor.user.id);
        const before = await roles.findByUserId(actor.user.id);
        await roles.replaceForUser(actor.user.id, [second.id], actor.user.id);
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
    expect((await roles.findByUserId(actor.user.id)).map((row) => row.roleId)).toEqual([second.id]);
  });
});
