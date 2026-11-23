import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { Session } from '../../domain/entities/session.js';
import type { SessionProcessExecutionRef } from '../../domain/policies/session-execution-rule.js';
import { PrismaSessionExecutionRepository } from './prisma-session-execution-repository.js';
import { PrismaSessionProcessExecutionReader } from './prisma-session-process-execution-reader.js';
import { PrismaSessionRepository } from './prisma-session-repository.js';
import { PrismaSessionStakeholderListReader } from './prisma-session-stakeholder-list-reader.js';

describe('PrismaSessionExecutionRepository & Readers Integration (PostgreSQL real, T-032-21)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const sessionRepository = new PrismaSessionRepository(uow);
  const executionRepository = new PrismaSessionExecutionRepository(uow);
  const processExecutionReader = new PrismaSessionProcessExecutionReader(uow);
  const stakeholderListReader = new PrismaSessionStakeholderListReader(uow);

  const NOW = new Date('2026-11-17T15:00:00.000Z');

  async function seedBaseExecutions(
    items: ReadonlyArray<{
      id: string;
      name: string;
      type?: 'P611' | 'P612' | 'P613' | 'P621' | 'P622' | 'P623';
      status?: 'PLANNED' | 'IN_PROGRESS' | 'CLOSED';
    }>,
  ) {
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

    await prisma.catalogVersion.upsert({
      where: { id: 'cv-1' },
      update: {},
      create: {
        id: 'cv-1',
        programId: 'prog-1',
        number: 1,
        status: 'APPROVED',
      },
    });

    for (const item of items) {
      await prisma.processExecution.create({
        data: {
          id: item.id,
          programId: 'prog-1',
          type: item.type ?? 'P612',
          name: item.name,
          year: 2026,
          catalogVersionId: 'cv-1',
          status: item.status ?? 'PLANNED',
          createdBy: 'user-1',
        },
      });
    }
  }

  it('links a session to three executions', async () => {
    await seedBaseExecutions([
      { id: 'exec-1', name: 'Revisión OE 2026', type: 'P613' },
      { id: 'exec-2', name: 'Medición OE 2026', type: 'P612' },
      { id: 'exec-3', name: 'Medición indirecta AG 2026', type: 'P623' },
    ]);

    const executions: SessionProcessExecutionRef[] = [
      { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
      { id: 'exec-2', name: 'Medición OE 2026', status: 'PLANNED' },
      { id: 'exec-3', name: 'Medición indirecta AG 2026', status: 'PLANNED' },
    ];

    await sessionRepository.save(
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executions,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    await executionRepository.replaceLinks({
      sessionId: 'sess-1',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
      actorId: 'user-1',
      now: NOW,
    });

    const linkedIds = await executionRepository.findExecutionIds('sess-1');
    expect(linkedIds).toEqual(['exec-1', 'exec-2', 'exec-3']);
  }, 5_000);

  it('lists the same session under each of its three executions', async () => {
    await seedBaseExecutions([
      { id: 'exec-1', name: 'Revisión OE 2026', type: 'P613' },
      { id: 'exec-2', name: 'Medición OE 2026', type: 'P612' },
      { id: 'exec-3', name: 'Medición indirecta AG 2026', type: 'P623' },
    ]);

    await sessionRepository.save(
      Session.create({
        id: 'sess-ca1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '15:00',
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.com/ca1',
        recordingUrl: 'https://drive.example.com/ca1',
        executions: [
          { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
          { id: 'exec-2', name: 'Medición OE 2026', status: 'PLANNED' },
          { id: 'exec-3', name: 'Medición indirecta AG 2026', status: 'PLANNED' },
        ],
        actorId: 'user-1',
        now: NOW,
      }),
    );

    await executionRepository.replaceLinks({
      sessionId: 'sess-ca1',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
      actorId: 'user-1',
      now: NOW,
    });

    for (const executionId of ['exec-1', 'exec-2', 'exec-3']) {
      const page = await executionRepository.listByExecution(executionId, {
        page: 1,
        pageSize: 20,
      });
      expect(page.total).toBe(1);
      expect(page.items[0]?.id).toBe('sess-ca1');
      expect(page.items[0]?.executionIds).toEqual(['exec-1', 'exec-2', 'exec-3']);
    }
  }, 5_000);

  it('replaces the links keeping at least the new set', async () => {
    await seedBaseExecutions([
      { id: 'exec-1', name: 'E1' },
      { id: 'exec-2', name: 'E2' },
      { id: 'exec-3', name: 'E3' },
    ]);

    await sessionRepository.save(
      Session.create({
        id: 'sess-rep',
        stakeholderType: 'GRADUATE',
        sessionDate: '2026-11-20',
        startTime: '11:00',
        modality: 'IN_PERSON',
        executions: [{ id: 'exec-1', name: 'E1', status: 'PLANNED' }],
        actorId: 'user-1',
        now: NOW,
      }),
    );

    await executionRepository.replaceLinks({
      sessionId: 'sess-rep',
      executionIds: ['exec-1', 'exec-2'],
      actorId: 'user-1',
      now: NOW,
    });

    await executionRepository.replaceLinks({
      sessionId: 'sess-rep',
      executionIds: ['exec-2', 'exec-3'],
      actorId: 'user-2',
      now: new Date('2026-11-17T16:00:00.000Z'),
    });

    expect(await executionRepository.findExecutionIds('sess-rep')).toEqual(['exec-2', 'exec-3']);
  }, 5_000);

  it('rejects a repeated pair', async () => {
    await seedBaseExecutions([{ id: 'exec-1', name: 'E1' }]);

    await sessionRepository.save(
      Session.create({
        id: 'sess-dup-link',
        stakeholderType: 'TEACHER',
        sessionDate: '2026-11-20',
        startTime: '12:00',
        modality: 'IN_PERSON',
        executions: [{ id: 'exec-1', name: 'E1', status: 'PLANNED' }],
        actorId: 'user-1',
        now: NOW,
      }),
    );

    await prisma.sessionExecution.create({
      data: {
        sessionId: 'sess-dup-link',
        processExecutionId: 'exec-1',
        createdBy: 'user-1',
      },
    });

    await expect(
      prisma.sessionExecution.create({
        data: {
          sessionId: 'sess-dup-link',
          processExecutionId: 'exec-1',
          createdBy: 'user-1',
        },
      }),
    ).rejects.toThrow();
  }, 5_000);

  it('lists with pagination and executionIds', async () => {
    await seedBaseExecutions([
      { id: 'exec-1', name: 'E1' },
      { id: 'exec-2', name: 'E2' },
    ]);

    const sessionsData = [
      { id: 'sess-p1', date: '2026-11-18', time: '09:00', execs: ['exec-1'] },
      { id: 'sess-p2', date: '2026-11-19', time: '09:00', execs: ['exec-1', 'exec-2'] },
      { id: 'sess-p3', date: '2026-11-20', time: '09:00', execs: ['exec-1'] },
    ];

    for (const item of sessionsData) {
      await sessionRepository.save(
        Session.create({
          id: item.id,
          stakeholderType: 'EMPLOYER',
          sessionDate: item.date,
          startTime: item.time,
          modality: 'IN_PERSON',
          executions: item.execs.map((id) => ({ id, name: id, status: 'PLANNED' as const })),
          actorId: 'user-1',
          now: NOW,
        }),
      );
      await executionRepository.replaceLinks({
        sessionId: item.id,
        executionIds: item.execs,
        actorId: 'user-1',
        now: NOW,
      });
    }

    const page1 = await executionRepository.listByExecution('exec-1', { page: 1, pageSize: 2 });
    expect(page1.total).toBe(3);
    expect(page1.items.map((i) => i.id)).toEqual(['sess-p3', 'sess-p2']);
    expect(page1.items[1]?.executionIds).toEqual(['exec-1', 'exec-2']);

    const page2 = await executionRepository.listByExecution('exec-1', { page: 2, pageSize: 2 });
    expect(page2.total).toBe(3);
    expect(page2.items.map((i) => i.id)).toEqual(['sess-p1']);
  }, 5_000);

  it('returns an empty page for an execution without sessions', async () => {
    await seedBaseExecutions([{ id: 'exec-empty', name: 'Vacía' }]);

    const page = await executionRepository.listByExecution('exec-empty', {
      page: 1,
      pageSize: 20,
    });
    expect(page.total).toBe(0);
    expect(page.items).toEqual([]);
  }, 5_000);

  it('reads executions by id and omits unknown ones', async () => {
    await seedBaseExecutions([
      { id: 'exec-a', name: 'Ejecución A', status: 'PLANNED' },
      { id: 'exec-b', name: 'Ejecución B', status: 'CLOSED' },
    ]);

    const found = await processExecutionReader.findByIds(['exec-a', 'exec-missing', 'exec-b']);
    expect(found).toHaveLength(2);
    expect(found).toEqual(
      expect.arrayContaining([
        { id: 'exec-a', name: 'Ejecución A', status: 'PLANNED' },
        { id: 'exec-b', name: 'Ejecución B', status: 'CLOSED' },
      ]),
    );
  }, 5_000);

  it('reads a stakeholder list by id and returns null for an unknown one', async () => {
    await seedBaseExecutions([]);
    await prisma.stakeholderList.create({
      data: {
        id: 'list-emp',
        programId: 'prog-1',
        type: 'EMPLOYER',
        year: 2026,
        createdBy: 'user-1',
      },
    });

    expect(await stakeholderListReader.findById('list-emp')).toEqual({
      id: 'list-emp',
      type: 'EMPLOYER',
    });
    expect(await stakeholderListReader.findById('list-unknown')).toBeNull();
  }, 5_000);

  it('counts attendees per session in one query including zero attendees', async () => {
    await seedBaseExecutions([{ id: 'exec-1', name: 'Ejecución 1' }]);
    await prisma.stakeholderList.create({
      data: {
        id: 'list-count',
        programId: 'prog-1',
        type: 'EMPLOYER',
        year: 2026,
        createdBy: 'user-1',
      },
    });
    await prisma.stakeholder.createMany({
      data: [
        { id: 'st-1', kind: 'PERSON', fullName: 'Persona 1', createdBy: 'user-1' },
        { id: 'st-2', kind: 'PERSON', fullName: 'Persona 2', createdBy: 'user-1' },
      ],
    });
    const m1 = await prisma.stakeholderListMember.create({
      data: {
        id: 'lm-1',
        listId: 'list-count',
        stakeholderId: 'st-1',
        fullName: 'Persona 1',
        createdBy: 'user-1',
      },
    });
    const m2 = await prisma.stakeholderListMember.create({
      data: {
        id: 'lm-2',
        listId: 'list-count',
        stakeholderId: 'st-2',
        fullName: 'Persona 2',
        createdBy: 'user-1',
      },
    });

    for (const [id, date] of [
      ['sess-c0', '2026-11-18'],
      ['sess-c1', '2026-11-19'],
      ['sess-c2', '2026-11-20'],
    ] as const) {
      await sessionRepository.save(
        Session.create({
          id,
          stakeholderType: 'EMPLOYER',
          stakeholderList: { id: 'list-count', type: 'EMPLOYER' },
          sessionDate: date,
          startTime: '10:00',
          modality: 'IN_PERSON',
          executions: [{ id: 'exec-1', name: 'Ejecución 1', status: 'PLANNED' }],
          actorId: 'user-1',
          now: NOW,
        }),
      );
      await executionRepository.replaceLinks({
        sessionId: id,
        executionIds: ['exec-1'],
        actorId: 'user-1',
        now: NOW,
      });
    }

    await prisma.attendee.createMany({
      data: [
        { sessionId: 'sess-c1', listMemberId: m1.id, createdBy: 'user-1' },
        { sessionId: 'sess-c2', listMemberId: m1.id, createdBy: 'user-1' },
        { sessionId: 'sess-c2', listMemberId: m2.id, createdBy: 'user-1' },
      ],
    });

    const page = await executionRepository.listByExecution('exec-1', { page: 1, pageSize: 10 });
    expect(page.items.map((item) => ({ id: item.id, attendeeCount: item.attendeeCount }))).toEqual([
      { id: 'sess-c2', attendeeCount: 2 },
      { id: 'sess-c1', attendeeCount: 1 },
      { id: 'sess-c0', attendeeCount: 0 },
    ]);
  }, 5_000);
});
