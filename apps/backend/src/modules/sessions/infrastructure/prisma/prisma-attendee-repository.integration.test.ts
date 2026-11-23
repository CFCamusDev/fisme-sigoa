import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { Session } from '../../domain/entities/session.js';
import { InvalidSessionDataError } from '../../domain/errors/invalid-session-data-error.js';
import type { SessionProcessExecutionRef } from '../../domain/policies/session-execution-rule.js';
import { PrismaAttendeeRepository } from './prisma-attendee-repository.js';
import { PrismaSessionListMemberReader } from './prisma-session-list-member-reader.js';
import { PrismaSessionRepository } from './prisma-session-repository.js';

describe('PrismaAttendeeRepository Integration (PostgreSQL real, T-033-12)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const attendeeRepository = new PrismaAttendeeRepository(uow);
  const sessionRepository = new PrismaSessionRepository(uow);
  const memberReader = new PrismaSessionListMemberReader(uow);

  const NOW = new Date('2026-11-17T15:00:00.000Z');
  const OPEN_EXECUTIONS: readonly SessionProcessExecutionRef[] = [
    { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
  ];

  async function seedSessionWithMembers() {
    await prisma.program.upsert({
      where: { id: 'prog-1' },
      update: {},
      create: {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });

    await prisma.stakeholderList.create({
      data: {
        id: 'list-1',
        programId: 'prog-1',
        type: 'EMPLOYER',
        year: 2026,
        createdBy: 'user-1',
      },
    });

    for (const [index, name] of ['Ana Pérez', 'Luis Torres', 'María Gómez'].entries()) {
      const stakeholderId = `st-${index + 1}`;
      const memberId = `mem-${index + 1}`;

      await prisma.stakeholder.create({
        data: {
          id: stakeholderId,
          kind: 'PERSON',
          fullName: name,
          email: `persona${index + 1}@example.test`,
          mobile: `90000000${index + 1}`,
          institution: `Empresa ${index + 1}`,
          position: `Cargo base ${index + 1}`,
          createdBy: 'user-1',
        },
      });

      await prisma.stakeholderListMember.create({
        data: {
          id: memberId,
          listId: 'list-1',
          stakeholderId,
          fullName: name,
          email: `persona${index + 1}@example.test`,
          mobile: `90000000${index + 1}`,
          institution: `Empresa ${index + 1}`,
          position: `Cargo base ${index + 1}`,
          createdBy: 'user-1',
        },
      });
    }

    const session = Session.create({
      id: 'sess-1',
      stakeholderType: 'EMPLOYER',
      stakeholderList: { id: 'list-1', type: 'EMPLOYER' },
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/room-1',
      recordingUrl: 'https://drive.example.com/rec-1',
      executions: OPEN_EXECUTIONS,
      actorId: 'user-1',
      now: NOW,
    });
    await sessionRepository.save(session);
  }

  it('persists attendees with their position', async () => {
    await seedSessionWithMembers();

    const saved = await uow.run(() =>
      attendeeRepository.replaceForSession({
        sessionId: 'sess-1',
        entries: [
          { listMemberId: 'mem-1', position: 'Gerente de TI' },
          { listMemberId: 'mem-2', position: null },
        ],
        actorId: 'user-1',
        now: NOW,
      }),
    );

    expect(saved).toHaveLength(2);
    expect(
      saved.map((item) => ({ listMemberId: item.listMemberId, position: item.position })),
    ).toEqual([
      { listMemberId: 'mem-1', position: 'Gerente de TI' },
      { listMemberId: 'mem-2', position: null },
    ]);

    const listed = await attendeeRepository.listBySession('sess-1');
    expect(listed.map((item) => item.listMemberId)).toEqual(['mem-1', 'mem-2']);
  }, 5_000);

  it('replaces the previous set', async () => {
    await seedSessionWithMembers();

    await uow.run(() =>
      attendeeRepository.replaceForSession({
        sessionId: 'sess-1',
        entries: [{ listMemberId: 'mem-1', position: 'Director' }],
        actorId: 'user-1',
        now: NOW,
      }),
    );

    const replaced = await uow.run(() =>
      attendeeRepository.replaceForSession({
        sessionId: 'sess-1',
        entries: [{ listMemberId: 'mem-3', position: 'Subgerente' }],
        actorId: 'user-2',
        now: NOW,
      }),
    );

    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.listMemberId).toBe('mem-3');
    expect(replaced[0]?.position).toBe('Subgerente');
  }, 5_000);

  it('counts attendees by session', async () => {
    await seedSessionWithMembers();

    expect(await attendeeRepository.countBySession('sess-1')).toBe(0);

    await uow.run(() =>
      attendeeRepository.replaceForSession({
        sessionId: 'sess-1',
        entries: [
          { listMemberId: 'mem-1', position: 'Cargo 1' },
          { listMemberId: 'mem-2', position: 'Cargo 2' },
        ],
        actorId: 'user-1',
        now: NOW,
      }),
    );

    expect(await attendeeRepository.countBySession('sess-1')).toBe(2);
  }, 5_000);

  it('rejects a repeated member', async () => {
    await seedSessionWithMembers();

    await expect(
      uow.run(() =>
        attendeeRepository.replaceForSession({
          sessionId: 'sess-1',
          entries: [
            { listMemberId: 'mem-1', position: 'Cargo 1' },
            { listMemberId: 'mem-1', position: 'Cargo 2' },
          ],
          actorId: 'user-1',
          now: NOW,
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidSessionDataError);
  }, 5_000);

  it('keeps exactly one coherent set under concurrent replacements', async () => {
    await seedSessionWithMembers();

    const setA = [
      { listMemberId: 'mem-1', position: 'Cargo A1' },
      { listMemberId: 'mem-2', position: 'Cargo A2' },
    ];
    const setB = [{ listMemberId: 'mem-3', position: 'Cargo B3' }];

    const results = await Promise.all([
      uow.run(async () => {
        await sessionRepository.findByIdForUpdate('sess-1');
        return attendeeRepository.replaceForSession({
          sessionId: 'sess-1',
          entries: setA,
          actorId: 'user-1',
          now: NOW,
        });
      }),
      uow.run(async () => {
        await sessionRepository.findByIdForUpdate('sess-1');
        return attendeeRepository.replaceForSession({
          sessionId: 'sess-1',
          entries: setB,
          actorId: 'user-2',
          now: NOW,
        });
      }),
    ]);

    expect(results).toHaveLength(2);

    const finalRows = await attendeeRepository.listBySession('sess-1');
    const finalSnapshot = finalRows.map((row) => ({
      listMemberId: row.listMemberId,
      position: row.position,
    }));

    const matchesSetA = JSON.stringify(finalSnapshot) === JSON.stringify(setA);
    const matchesSetB = JSON.stringify(finalSnapshot) === JSON.stringify(setB);
    expect(matchesSetA || matchesSetB).toBe(true);
  }, 5_000);

  it('reads list members without exposing email or mobile', async () => {
    await seedSessionWithMembers();

    const roster = await memberReader.listByList('list-1');
    expect(roster).toHaveLength(3);
    for (const item of roster) {
      expect(Object.keys(item).sort()).toEqual([
        'fullName',
        'id',
        'institution',
        'position',
        'representative',
        'ruc',
      ]);
    }

    const refs = await memberReader.findByIds(['mem-1', 'mem-2']);
    expect(refs).toHaveLength(2);
    expect(refs.every((ref) => ref.listId === 'list-1')).toBe(true);
  }, 5_000);
});
