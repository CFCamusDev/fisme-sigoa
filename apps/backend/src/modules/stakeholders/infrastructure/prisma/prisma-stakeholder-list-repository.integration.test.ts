import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { StakeholderList } from '../../domain/entities/stakeholder-list.js';
import { StakeholderListMember } from '../../domain/entities/stakeholder-list-member.js';
import { Stakeholder } from '../../domain/entities/stakeholder.js';
import { DuplicateStakeholderListError } from '../../domain/errors/index.js';
import { PrismaStakeholderListMemberRepository } from './prisma-stakeholder-list-member-repository.js';
import { PrismaStakeholderListProgramResolver } from './prisma-stakeholder-list-program-resolver.js';
import { PrismaStakeholderListRepository } from './prisma-stakeholder-list-repository.js';
import { PrismaStakeholderRepository } from './prisma-stakeholder-repository.js';

describe('PrismaStakeholderListRepository Integration (PostgreSQL real, T-022-22)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaStakeholderListRepository(uow);
  const memberRepository = new PrismaStakeholderListMemberRepository(uow);
  const stakeholderRepository = new PrismaStakeholderRepository(uow);
  const programResolver = new PrismaStakeholderListProgramResolver(uow);

  const NOW = new Date('2026-11-16T10:00:00.000Z');

  async function createProgram(id = 'prog-1', code = 'EPIS') {
    await prisma.program.create({
      data: {
        id,
        code,
        name: 'Ingenieria de Sistemas',
        faculty: 'FISME',
      },
    });
    return id;
  }

  it('persists and reads back a list', async () => {
    const programId = await createProgram();
    const list = StakeholderList.create({
      id: 'list-1',
      programId,
      type: 'EMPLOYER',
      year: 2027,
      studyPlanNumber: '2024-II',
      version: 'v1.0',
      actorId: 'user-1',
      now: NOW,
    });

    await repository.save(list);

    const found = await repository.findById('list-1');
    expect(found).not.toBeNull();
    expect(found?.programId).toBe(programId);
    expect(found?.type).toBe('EMPLOYER');
    expect(found?.year).toBe(2027);
    expect(found?.studyPlanNumber).toBe('2024-II');
    expect(found?.version).toBe('v1.0');
    expect(await repository.findById('missing-list')).toBeNull();
    expect(await programResolver.getCurrentProgramId()).toBe(programId);
  }, 5_000);

  it('rejects a duplicate program, type and year', async () => {
    const programId = await createProgram();
    await repository.save(
      StakeholderList.create({
        id: 'list-1',
        programId,
        type: 'EMPLOYER',
        year: 2027,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    await expect(
      repository.save(
        StakeholderList.create({
          id: 'list-2',
          programId,
          type: 'EMPLOYER',
          year: 2027,
          actorId: 'user-1',
          now: NOW,
        }),
      ),
    ).rejects.toBeInstanceOf(DuplicateStakeholderListError);
  }, 5_000);

  it('lets exactly one of two concurrent saves of the same program, type and year win', async () => {
    const programId = await createProgram();
    const first = StakeholderList.create({
      id: 'list-c1',
      programId,
      type: 'GRADUATE',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    const second = StakeholderList.create({
      id: 'list-c2',
      programId,
      type: 'GRADUATE',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    const results = await Promise.allSettled([repository.save(first), repository.save(second)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(DuplicateStakeholderListError);
  }, 5_000);

  it('lists with filters, pagination and member counts', async () => {
    const programId = await createProgram();
    const list2026 = StakeholderList.create({
      id: 'list-2026',
      programId,
      type: 'EMPLOYER',
      year: 2026,
      actorId: 'user-1',
      now: NOW,
    });
    const list2027 = StakeholderList.create({
      id: 'list-2027',
      programId,
      type: 'EMPLOYER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    const teacher2027 = StakeholderList.create({
      id: 'list-t-2027',
      programId,
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    await repository.save(list2026);
    await repository.save(list2027);
    await repository.save(teacher2027);

    const teacher = Stakeholder.register({
      id: 'stk-t1',
      kind: 'PERSON',
      fullName: 'Docente Uno',
      dni: '12345678',
      email: 'docente@untrm.edu.pe',
      mobile: '987654321',
      actorId: 'user-1',
      now: NOW,
    });
    await stakeholderRepository.save(teacher);
    await memberRepository.add(
      StakeholderListMember.create({
        id: 'mem-1',
        list: teacher2027,
        stakeholder: teacher,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    const page1 = await repository.list({
      year: 2027,
      includeMembers: false,
      page: 1,
      pageSize: 1,
    });

    expect(page1.total).toBe(2);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]?.list.id).toBe('list-2027');
    expect(page1.items[0]?.memberCount).toBe(0);
    expect(page1.items[0]?.members).toBeNull();

    const teacherFiltered = await repository.list({
      type: 'TEACHER',
      year: 2027,
      includeMembers: false,
      page: 1,
      pageSize: 20,
    });
    expect(teacherFiltered.total).toBe(1);
    expect(teacherFiltered.items[0]?.memberCount).toBe(1);
  }, 5_000);

  it('returns members only when requested', async () => {
    const programId = await createProgram();
    const list = StakeholderList.create({
      id: 'list-1',
      programId,
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    await repository.save(list);

    const teacher = Stakeholder.register({
      id: 'stk-t1',
      kind: 'PERSON',
      fullName: 'Docente Uno',
      dni: '12345678',
      email: 'docente@untrm.edu.pe',
      mobile: '987654321',
      actorId: 'user-1',
      now: NOW,
    });
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

    const withoutMembers = await repository.list({
      type: 'TEACHER',
      year: 2027,
      includeMembers: false,
      page: 1,
      pageSize: 20,
    });
    expect(withoutMembers.items[0]?.members).toBeNull();

    const withMembers = await repository.list({
      type: 'TEACHER',
      year: 2027,
      includeMembers: true,
      page: 1,
      pageSize: 20,
    });
    expect(withMembers.items[0]?.members).toHaveLength(1);
    expect(withMembers.items[0]?.members?.[0]?.fullName).toBe('Docente Uno');
  }, 5_000);

  it('lists all lists with members for a program and year ordered by type and member name', async () => {
    const programId = await createProgram('prog-a', 'EPIS-A');
    const otherProgramId = await createProgram('prog-b', 'EPIS-B');

    const teacherList = StakeholderList.create({
      id: 'list-t-2026',
      programId,
      type: 'TEACHER',
      year: 2026,
      actorId: 'user-1',
      now: NOW,
    });
    const advisoryList = StakeholderList.create({
      id: 'list-a-2026',
      programId,
      type: 'ADVISORY_BOARD',
      year: 2026,
      actorId: 'user-1',
      now: NOW,
    });
    const otherYearList = StakeholderList.create({
      id: 'list-t-2027',
      programId,
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    const otherProgramList = StakeholderList.create({
      id: 'list-other-prog',
      programId: otherProgramId,
      type: 'TEACHER',
      year: 2026,
      actorId: 'user-1',
      now: NOW,
    });

    await repository.save(teacherList);
    await repository.save(advisoryList);
    await repository.save(otherYearList);
    await repository.save(otherProgramList);

    const teacherB = Stakeholder.register({
      id: 'stk-b',
      kind: 'PERSON',
      stakeholderType: 'TEACHER',
      documentNumber: '10000002',
      fullName: 'Zulema Torres',
      email: 'zulema@ejemplo.test',
      actorId: 'user-1',
      now: NOW,
    });
    const teacherA = Stakeholder.register({
      id: 'stk-a',
      kind: 'PERSON',
      stakeholderType: 'TEACHER',
      documentNumber: '10000001',
      fullName: 'Alberto Ramos',
      email: 'alberto@ejemplo.test',
      actorId: 'user-1',
      now: NOW,
    });

    await stakeholderRepository.save(teacherB);
    await stakeholderRepository.save(teacherA);

    await memberRepository.add(
      StakeholderListMember.create({
        id: 'mem-b',
        list: teacherList,
        stakeholder: teacherB,
        actorId: 'user-1',
        now: NOW,
      }),
    );
    await memberRepository.add(
      StakeholderListMember.create({
        id: 'mem-a',
        list: teacherList,
        stakeholder: teacherA,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    const result = await repository.listByProgramAndYear(programId, 2026);
    expect(result.map((entry) => entry.list.type)).toEqual(['ADVISORY_BOARD', 'TEACHER']);
    expect(result[0]?.members).toEqual([]);
    expect(result[1]?.members.map((member) => member.fullName)).toEqual([
      'Alberto Ramos',
      'Zulema Torres',
    ]);
  }, 5_000);
});
