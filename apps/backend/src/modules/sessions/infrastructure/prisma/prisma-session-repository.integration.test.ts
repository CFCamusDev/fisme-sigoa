import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { Session } from '../../domain/entities/session.js';
import { DuplicateSessionError } from '../../domain/errors/duplicate-session-error.js';
import type { SessionProcessExecutionRef } from '../../domain/policies/session-execution-rule.js';
import { PrismaSessionRepository } from './prisma-session-repository.js';

describe('PrismaSessionRepository Integration (PostgreSQL real, T-032-20)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaSessionRepository(uow);

  const NOW = new Date('2026-11-17T15:00:00.000Z');
  const OPEN_EXECUTIONS: readonly SessionProcessExecutionRef[] = [
    { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
  ];

  async function createStakeholderList(
    id = 'list-1',
    type: 'ADVISORY_BOARD' | 'EMPLOYER' | 'GRADUATE' | 'STUDENT' | 'TEACHER' = 'EMPLOYER',
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

    await prisma.stakeholderList.create({
      data: {
        id,
        programId: 'prog-1',
        type,
        year: 2026,
        createdBy: 'user-1',
      },
    });

    return { id, type };
  }

  it('persists and reads back a session', async () => {
    const list = await createStakeholderList();
    const session = Session.create({
      id: 'sess-1',
      stakeholderType: 'EMPLOYER',
      stakeholderList: list,
      sessionDate: '2026-11-20',
      startTime: '10:30',
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/room-1',
      recordingUrl: 'https://drive.example.com/rec-1',
      executions: OPEN_EXECUTIONS,
      actorId: 'user-1',
      now: NOW,
    });

    await repository.save(session);

    const loaded = await uow.run(() => repository.findByIdForUpdate('sess-1'));
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe('sess-1');
    expect(loaded?.stakeholderType).toBe('EMPLOYER');
    expect(loaded?.stakeholderListId).toBe('list-1');
    expect(loaded?.sessionDate).toBe('2026-11-20');
    expect(loaded?.startTime).toBe('10:30');
    expect(loaded?.modality).toBe('VIRTUAL');
    expect(loaded?.meetingUrl).toBe('https://meet.example.com/room-1');
    expect(loaded?.recordingUrl).toBe('https://drive.example.com/rec-1');
  }, 5_000);

  it('rejects a duplicate type, date and time', async () => {
    await repository.save(
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    await expect(
      repository.save(
        Session.create({
          id: 'sess-2',
          stakeholderType: 'EMPLOYER',
          sessionDate: '2026-11-20',
          startTime: '10:00',
          modality: 'HYBRID',
          executions: OPEN_EXECUTIONS,
          actorId: 'user-2',
          now: NOW,
        }),
      ),
    ).rejects.toBeInstanceOf(DuplicateSessionError);
  }, 5_000);

  it('lets exactly one of two concurrent saves with the same type, date and time win', async () => {
    const s1 = Session.create({
      id: 'sess-conc-1',
      stakeholderType: 'GRADUATE',
      sessionDate: '2026-11-21',
      startTime: '18:00',
      modality: 'IN_PERSON',
      executions: OPEN_EXECUTIONS,
      actorId: 'user-1',
      now: NOW,
    });

    const s2 = Session.create({
      id: 'sess-conc-2',
      stakeholderType: 'GRADUATE',
      sessionDate: '2026-11-21',
      startTime: '18:00',
      modality: 'HYBRID',
      executions: OPEN_EXECUTIONS,
      actorId: 'user-2',
      now: NOW,
    });

    const results = await Promise.allSettled([repository.save(s1), repository.save(s2)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(DuplicateSessionError);
  }, 5_000);

  it('serializes two concurrent editors with findByIdForUpdate', async () => {
    await repository.save(
      Session.create({
        id: 'sess-edit-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-22',
        startTime: '09:00',
        modality: 'IN_PERSON',
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    const editA = uow.run(async () => {
      const current = await repository.findByIdForUpdate('sess-edit-1');
      if (!current) throw new Error('Expected session');
      const updated = current.applyChanges({
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.com/a',
        recordingUrl: 'https://drive.example.com/a',
        actorId: 'editor-a',
        now: new Date('2026-11-17T16:00:00.000Z'),
      });
      await repository.update(updated);
      return updated;
    });

    const editB = uow.run(async () => {
      const current = await repository.findByIdForUpdate('sess-edit-1');
      if (!current) throw new Error('Expected session');
      const updated = current.applyChanges({
        modality: 'HYBRID',
        meetingUrl: 'https://meet.example.com/b',
        recordingUrl: null,
        actorId: 'editor-b',
        now: new Date('2026-11-17T16:01:00.000Z'),
      });
      await repository.update(updated);
      return updated;
    });

    await Promise.all([editA, editB]);

    const finalRow = await prisma.session.findUnique({ where: { id: 'sess-edit-1' } });
    expect(finalRow).not.toBeNull();
    if (finalRow?.modality === 'VIRTUAL') {
      expect(finalRow.meetingUrl).toBe('https://meet.example.com/a');
      expect(finalRow.recordingUrl).toBe('https://drive.example.com/a');
      expect(finalRow.updatedBy).toBe('editor-a');
    } else {
      expect(finalRow?.modality).toBe('HYBRID');
      expect(finalRow?.meetingUrl).toBe('https://meet.example.com/b');
      expect(finalRow?.recordingUrl).toBeNull();
      expect(finalRow?.updatedBy).toBe('editor-b');
    }
  }, 5_000);

  it('rejects a virtual session without links at the database level', async () => {
    await expect(
      prisma.session.create({
        data: {
          id: 'sess-db-virtual',
          stakeholderType: 'EMPLOYER',
          sessionDate: new Date(Date.UTC(2026, 10, 23)),
          startTime: '11:00',
          modality: 'VIRTUAL',
          meetingUrl: 'https://meet.example.com/only-one',
          recordingUrl: null,
          createdBy: 'user-1',
        },
      }),
    ).rejects.toThrow();
  }, 5_000);

  it('rejects a malformed start time at the database level', async () => {
    await expect(
      prisma.session.create({
        data: {
          id: 'sess-db-time',
          stakeholderType: 'EMPLOYER',
          sessionDate: new Date(Date.UTC(2026, 10, 23)),
          startTime: '99:99',
          modality: 'IN_PERSON',
          createdBy: 'user-1',
        },
      }),
    ).rejects.toThrow();
  }, 5_000);

  it('keeps the date unchanged across time zones', async () => {
    await repository.save(
      Session.create({
        id: 'sess-tz',
        stakeholderType: 'TEACHER',
        sessionDate: '2026-01-01',
        startTime: '00:05',
        modality: 'IN_PERSON',
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    const loaded = await uow.run(() => repository.findByIdForUpdate('sess-tz'));
    expect(loaded?.sessionDate).toBe('2026-01-01');
  }, 5_000);
});
