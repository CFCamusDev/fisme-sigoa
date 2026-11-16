import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { StakeholderList } from '../../domain/entities/stakeholder-list.js';
import { StakeholderListMember } from '../../domain/entities/stakeholder-list-member.js';
import { Stakeholder } from '../../domain/entities/stakeholder.js';
import { DuplicateListMemberError } from '../../domain/errors/index.js';
import { PrismaStakeholderListMemberRepository } from './prisma-stakeholder-list-member-repository.js';
import { PrismaStakeholderListRepository } from './prisma-stakeholder-list-repository.js';
import { PrismaStakeholderRepository } from './prisma-stakeholder-repository.js';

describe('PrismaStakeholderListMemberRepository Integration (PostgreSQL real, T-022-23)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const listRepository = new PrismaStakeholderListRepository(uow);
  const memberRepository = new PrismaStakeholderListMemberRepository(uow);
  const stakeholderRepository = new PrismaStakeholderRepository(uow);

  const NOW = new Date('2026-11-16T10:00:00.000Z');

  async function seedList(listId = 'list-1') {
    await prisma.program.create({
      data: {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingenieria de Sistemas',
        faculty: 'FISME',
      },
    });
    const list = StakeholderList.create({
      id: listId,
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    await listRepository.save(list);
    return list;
  }

  function makeTeacher(id: string, fullName: string, dni: string) {
    return Stakeholder.register({
      id,
      kind: 'PERSON',
      fullName,
      dni,
      email: `${id}@untrm.edu.pe`,
      mobile: '987654321',
      actorId: 'user-1',
      now: NOW,
    });
  }

  it('adds and lists members ordered by name', async () => {
    const list = await seedList();
    const zulema = makeTeacher('stk-z', 'Zulema Quispe', '11111111');
    const andres = makeTeacher('stk-a', 'Andres Vega', '22222222');
    await stakeholderRepository.save(zulema);
    await stakeholderRepository.save(andres);

    await memberRepository.add(
      StakeholderListMember.create({
        id: 'mem-z',
        list,
        stakeholder: zulema,
        actorId: 'user-1',
        now: NOW,
      }),
    );
    await memberRepository.add(
      StakeholderListMember.create({
        id: 'mem-a',
        list,
        stakeholder: andres,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    const members = await memberRepository.listByListId(list.id);
    expect(members.map((m) => m.fullName)).toEqual(['Andres Vega', 'Zulema Quispe']);
  }, 5_000);

  it('rejects the same stakeholder twice in a list', async () => {
    const list = await seedList();
    const teacher = makeTeacher('stk-1', 'Carlos Ruiz', '33333333');
    await stakeholderRepository.save(teacher);

    await memberRepository.add(
      StakeholderListMember.create({
        id: 'mem-1',
        list,
        stakeholder: teacher,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    await expect(
      memberRepository.add(
        StakeholderListMember.create({
          id: 'mem-2',
          list,
          stakeholder: teacher,
          actorId: 'user-1',
          now: NOW,
        }),
      ),
    ).rejects.toBeInstanceOf(DuplicateListMemberError);
  }, 5_000);

  it('lets exactly one of two concurrent adds of the same stakeholder win', async () => {
    const list = await seedList();
    const teacher = makeTeacher('stk-c', 'Elena Diaz', '44444444');
    await stakeholderRepository.save(teacher);

    const first = StakeholderListMember.create({
      id: 'mem-c1',
      list,
      stakeholder: teacher,
      actorId: 'user-1',
      now: NOW,
    });
    const second = StakeholderListMember.create({
      id: 'mem-c2',
      list,
      stakeholder: teacher,
      actorId: 'user-1',
      now: NOW,
    });

    const results = await Promise.allSettled([
      memberRepository.add(first),
      memberRepository.add(second),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(DuplicateListMemberError);
  }, 5_000);

  it('adds many members atomically', async () => {
    const list = await seedList();
    const t1 = makeTeacher('stk-m1', 'Beto Rojas', '55555551');
    const t2 = makeTeacher('stk-m2', 'Ana Silva', '55555552');
    await stakeholderRepository.save(t1);
    await stakeholderRepository.save(t2);

    await memberRepository.addMany([]);
    expect(await memberRepository.listByListId(list.id)).toEqual([]);

    const m1 = StakeholderListMember.create({
      id: 'mem-m1',
      list,
      stakeholder: t1,
      actorId: 'user-1',
      now: NOW,
    });
    const m2 = StakeholderListMember.create({
      id: 'mem-m2',
      list,
      stakeholder: t2,
      actorId: 'user-1',
      now: NOW,
    });

    await memberRepository.addMany([m1, m2]);

    const stored = await memberRepository.listByListId(list.id);
    expect(stored.map((m) => m.fullName)).toEqual(['Ana Silva', 'Beto Rojas']);
  }, 5_000);
});
