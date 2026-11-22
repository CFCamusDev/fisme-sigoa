import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaExecutionBoardSessionsReader } from './prisma-execution-board-sessions-reader.js';

describe('PrismaExecutionBoardSessionsReader Integration (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const reader = new PrismaExecutionBoardSessionsReader(uow);

  async function seedExecution(executionId: string): Promise<void> {
    await prisma.program.upsert({
      where: { id: 'prog-board-sess' },
      update: {},
      create: {
        id: 'prog-board-sess',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });

    await prisma.catalogVersion.upsert({
      where: { id: 'cv-board-sess' },
      update: {},
      create: {
        id: 'cv-board-sess',
        programId: 'prog-board-sess',
        number: 1,
        status: 'APPROVED',
      },
    });

    await prisma.processExecution.create({
      data: {
        id: executionId,
        programId: 'prog-board-sess',
        type: 'P612',
        name: `Ejecución ${executionId}`,
        year: 2027,
        catalogVersionId: 'cv-board-sess',
        status: 'IN_PROGRESS',
        createdBy: 'user-1',
        updatedBy: 'user-1',
      },
    });
  }

  it('returns zero total, null lastSessionDate and empty items when there are no sessions', async () => {
    await seedExecution('exec-empty-sess');

    const summary = await reader.summarize('exec-empty-sess');

    expect(summary).toEqual({
      total: 0,
      lastSessionDate: null,
      items: [],
    });
  });

  it('returns total count, latest date and at most 5 sessions ordered by date and time desc', async () => {
    await seedExecution('exec-many-sess');
    await seedExecution('exec-other-sess');

    const fixtures = [
      { id: 's1', date: '2027-01-10', time: '09:00', modality: 'VIRTUAL' as const },
      { id: 's2', date: '2027-02-01', time: '08:00', modality: 'IN_PERSON' as const },
      { id: 's3', date: '2027-02-01', time: '14:00', modality: 'HYBRID' as const },
      { id: 's4', date: '2027-03-05', time: '10:00', modality: 'VIRTUAL' as const },
      { id: 's5', date: '2027-03-05', time: '16:30', modality: 'IN_PERSON' as const },
      { id: 's6', date: '2027-04-12', time: '11:00', modality: 'VIRTUAL' as const },
    ];

    for (const f of fixtures) {
      await prisma.session.create({
        data: {
          id: f.id,
          stakeholderType: 'EMPLOYER',
          sessionDate: new Date(`${f.date}T00:00:00.000Z`),
          startTime: f.time,
          modality: f.modality,
          ...(f.modality === 'VIRTUAL'
            ? {
                meetingUrl: `https://meet.example.com/${f.id}`,
                recordingUrl: `https://video.example.com/${f.id}`,
              }
            : {}),
          createdBy: 'user-1',
          executions: {
            create: {
              processExecutionId: 'exec-many-sess',
              createdBy: 'user-1',
            },
          },
        },
      });
    }

    await prisma.session.create({
      data: {
        id: 's-other',
        stakeholderType: 'GRADUATE',
        sessionDate: new Date('2027-05-01T00:00:00.000Z'),
        startTime: '15:00',
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.com/s-other',
        recordingUrl: 'https://video.example.com/s-other',
        createdBy: 'user-1',
        executions: {
          create: {
            processExecutionId: 'exec-other-sess',
            createdBy: 'user-1',
          },
        },
      },
    });

    const summary = await reader.summarize('exec-many-sess');

    expect(summary.total).toBe(6);
    expect(summary.lastSessionDate).toBe('2027-04-12');
    expect(summary.items.map((item) => item.id)).toEqual(['s6', 's5', 's4', 's3', 's2']);
    expect(summary.items[0]).toEqual({
      id: 's6',
      stakeholderType: 'EMPLOYER',
      sessionDate: '2027-04-12',
      startTime: '11:00',
      modality: 'VIRTUAL',
    });
  });
});
