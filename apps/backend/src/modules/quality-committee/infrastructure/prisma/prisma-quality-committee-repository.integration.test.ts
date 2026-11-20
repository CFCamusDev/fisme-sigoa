import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { QualityCommitteeOverlapError } from '../../domain/errors/quality-committee-overlap-error.js';
import { assertNoOverlap } from '../../domain/policies/committee-composition.js';
import { PrismaCommitteeProgramResolver } from './prisma-committee-program-resolver.js';
import { PrismaQualityCommitteeRepository } from './prisma-quality-committee-repository.js';

describe('PrismaQualityCommitteeRepository Integration (PostgreSQL real, T-025-23)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaQualityCommitteeRepository(uow);
  const programResolver = new PrismaCommitteeProgramResolver(uow);

  const NOW = new Date('2026-11-19T15:00:00.000Z');

  async function seedProgram(id = 'prog-1', code = 'EPIS') {
    await prisma.program.upsert({
      where: { id },
      update: {},
      create: {
        id,
        code,
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
  }

  it('persists a committee with its period and resolves the current program', async () => {
    await seedProgram();

    const resolvedProgramId = await programResolver.getCurrentProgramId();
    expect(resolvedProgramId).toBe('prog-1');

    const created = await uow.run(() =>
      repository.create({
        id: 'com-2027',
        programId: 'prog-1',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        actorId: 'user-1',
        now: NOW,
      }),
    );

    expect(created.id).toBe('com-2027');
    expect(created.programId).toBe('prog-1');
    expect(created.periodStart).toBe('2027-01-01');
    expect(created.periodEnd).toBe('2027-12-31');
    expect(created.createdBy).toBe('user-1');
    expect(created.updatedBy).toBeNull();

    const found = await repository.findById('com-2027');
    expect(found).toEqual(created);

    const touchedAt = new Date('2026-11-20T12:00:00.000Z');
    const touched = await uow.run(() => repository.touch('com-2027', 'user-2', touchedAt));
    expect(touched.updatedBy).toBe('user-2');
    expect(touched.updatedAt.toISOString()).toBe(touchedAt.toISOString());
  }, 5_000);

  it('finds the committee in force on its first and last day', async () => {
    await seedProgram();

    await repository.create({
      id: 'com-2027',
      programId: 'prog-1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      actorId: 'user-1',
      now: NOW,
    });

    const onFirstDay = await repository.findInForce('prog-1', '2027-01-01');
    const onMiddleDay = await repository.findInForce('prog-1', '2027-06-15');
    const onLastDay = await repository.findInForce('prog-1', '2027-12-31');

    expect(onFirstDay?.id).toBe('com-2027');
    expect(onMiddleDay?.id).toBe('com-2027');
    expect(onLastDay?.id).toBe('com-2027');
  }, 5_000);

  it('returns null when no committee is in force', async () => {
    await seedProgram();

    await repository.create({
      id: 'com-2027',
      programId: 'prog-1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      actorId: 'user-1',
      now: NOW,
    });

    expect(await repository.findInForce('prog-1', '2026-12-31')).toBeNull();
    expect(await repository.findInForce('prog-1', '2028-01-01')).toBeNull();
  }, 5_000);

  it('lists the history from the newest period', async () => {
    await seedProgram();

    await repository.create({
      id: 'com-2025',
      programId: 'prog-1',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
      actorId: 'user-1',
      now: NOW,
    });
    await repository.create({
      id: 'com-2027',
      programId: 'prog-1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      actorId: 'user-1',
      now: NOW,
    });
    await repository.create({
      id: 'com-2026',
      programId: 'prog-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      actorId: 'user-1',
      now: NOW,
    });

    const page1 = await repository.listPage({ programId: 'prog-1', page: 1, pageSize: 2 });
    expect(page1.total).toBe(3);
    expect(page1.items.map((item) => item.id)).toEqual(['com-2027', 'com-2026']);

    const page2 = await repository.listPage({ programId: 'prog-1', page: 2, pageSize: 2 });
    expect(page2.total).toBe(3);
    expect(page2.items.map((item) => item.id)).toEqual(['com-2025']);
  }, 5_000);

  it('lists overlapping periods of the program', async () => {
    await seedProgram('prog-1', 'EPIS');
    await seedProgram('prog-2', 'OTHER');

    await repository.create({
      id: 'com-p1-2027',
      programId: 'prog-1',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      actorId: 'user-1',
      now: NOW,
    });
    await repository.create({
      id: 'com-p2-2027',
      programId: 'prog-2',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      actorId: 'user-1',
      now: NOW,
    });

    const prog1Committees = await repository.listByProgram('prog-1');
    expect(prog1Committees.map((item) => item.id)).toEqual(['com-p1-2027']);
  }, 5_000);

  it('locks the program row for concurrent writers', async () => {
    await seedProgram();

    const outcomes = await Promise.allSettled(
      Array.from({ length: 4 }, (_, index) =>
        uow.run(async () => {
          await repository.lockProgram('prog-1');
          const existing = await repository.listByProgram('prog-1');
          assertNoOverlap({
            period: { periodStart: '2027-01-01', periodEnd: '2027-12-31' },
            existing,
          });
          return repository.create({
            id: `com-race-${index}`,
            programId: 'prog-1',
            periodStart: '2027-01-01',
            periodEnd: '2027-12-31',
            actorId: `user-${index}`,
            now: NOW,
          });
        }),
      ),
    );

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(3);
    for (const item of rejected) {
      expect(item.reason).toBeInstanceOf(QualityCommitteeOverlapError);
    }

    const persisted = await repository.listByProgram('prog-1');
    expect(persisted).toHaveLength(1);
  }, 5_000);
});
