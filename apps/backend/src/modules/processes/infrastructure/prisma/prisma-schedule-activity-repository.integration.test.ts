import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { ScheduleActivity } from '../../domain/entities/schedule-activity.js';
import { ScheduleAlreadyDefinedError } from '../../domain/errors/schedule-already-defined-error.js';
import { PrismaScheduleActivityRepository } from './prisma-schedule-activity-repository.js';
import { PrismaScheduleExecutionLocker } from './prisma-schedule-execution-locker.js';

describe('PrismaScheduleActivityRepository Integration (PostgreSQL real, T-028-20)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaScheduleActivityRepository(uow);
  const locker = new PrismaScheduleExecutionLocker(uow);

  const NOW = new Date('2027-03-10T12:00:00.000Z');

  async function createExecution(id = 'exec-1') {
    await prisma.program.create({
      data: {
        id: `prog-${id}`,
        code: `EPIS-${id}`,
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
    await prisma.catalogVersion.create({
      data: {
        id: `cv-${id}`,
        programId: `prog-${id}`,
        number: 1,
        status: 'APPROVED',
      },
    });
    await prisma.processExecution.create({
      data: {
        id,
        programId: `prog-${id}`,
        type: 'P612',
        name: `Medición anual ${id}`,
        year: 2027,
        catalogVersionId: `cv-${id}`,
        status: 'PLANNED',
        createdBy: 'user-1',
      },
    });
    return id;
  }

  it('persists and reads back activities ordered by number', async () => {
    const executionId = await createExecution('exec-order');

    const second = ScheduleActivity.create({
      id: 'act-2',
      executionId,
      number: 2,
      activity: 'Segunda actividad',
      responsible: 'Comité',
      startDate: '2027-04-01',
      endDate: '2027-04-15',
      actorId: 'user-1',
      now: NOW,
    });
    const first = ScheduleActivity.create({
      id: 'act-1',
      executionId,
      number: 1,
      activity: 'Primera actividad',
      responsible: 'Presidente',
      goal: 'Anexo 1',
      indicator: '1 documento',
      actorId: 'user-1',
      now: NOW,
    });

    await repository.insertMany([second, first]);

    const loaded = await repository.findByExecutionId(executionId);
    expect(loaded.map((item) => item.number)).toEqual([1, 2]);
    expect(loaded[0]?.id).toBe('act-1');
    expect(loaded[0]?.goal).toBe('Anexo 1');
    expect(loaded[1]?.startDate).toBe('2027-04-01');
    expect(loaded[1]?.endDate).toBe('2027-04-15');
  }, 5_000);

  it('rejects a duplicate number for the same execution at commit', async () => {
    const executionId = await createExecution('exec-dup');

    const a1 = ScheduleActivity.create({
      id: 'act-dup-1',
      executionId,
      number: 1,
      activity: 'Actividad 1',
      responsible: 'Presidente',
      actorId: 'user-1',
      now: NOW,
    });
    const a2 = ScheduleActivity.create({
      id: 'act-dup-2',
      executionId,
      number: 1,
      activity: 'Actividad duplicada',
      responsible: 'Presidente',
      actorId: 'user-1',
      now: NOW,
    });

    await expect(uow.run(() => repository.insertMany([a1, a2]))).rejects.toThrow();
  }, 5_000);

  it('allows swapping two numbers inside one transaction', async () => {
    const executionId = await createExecution('exec-swap');

    const first = ScheduleActivity.create({
      id: 'act-swap-1',
      executionId,
      number: 1,
      activity: 'Actividad A',
      responsible: 'Presidente',
      actorId: 'user-1',
      now: NOW,
    });
    const second = ScheduleActivity.create({
      id: 'act-swap-2',
      executionId,
      number: 2,
      activity: 'Actividad B',
      responsible: 'Presidente',
      actorId: 'user-1',
      now: NOW,
    });

    await repository.insertMany([first, second]);

    await uow.run(async () => {
      await repository.update(first.renumber(2, 'user-1', NOW));
      await repository.update(second.renumber(1, 'user-1', NOW));
    });

    const loaded = await repository.findByExecutionId(executionId);
    expect(loaded.map((item) => item.id)).toEqual(['act-swap-2', 'act-swap-1']);
    expect(loaded.map((item) => item.number)).toEqual([1, 2]);
  }, 5_000);

  it('rejects an end date before the start date at the database level', async () => {
    const executionId = await createExecution('exec-dates');

    await expect(
      prisma.scheduleActivity.create({
        data: {
          id: 'act-bad-dates',
          processExecutionId: executionId,
          number: 1,
          activity: 'Actividad con fechas invertidas',
          responsible: 'Presidente',
          startDate: new Date('2027-05-20T00:00:00.000Z'),
          endDate: new Date('2027-05-10T00:00:00.000Z'),
          status: 'PENDING',
          createdBy: 'user-1',
        },
      }),
    ).rejects.toThrow();
  }, 5_000);

  it('rejects a COMPLETED activity without actual end date at the database level', async () => {
    const executionId = await createExecution('exec-comp-null');

    await expect(
      prisma.scheduleActivity.create({
        data: {
          id: 'act-comp-null',
          processExecutionId: executionId,
          number: 1,
          activity: 'Actividad completada sin fecha real',
          responsible: 'Presidente',
          status: 'COMPLETED',
          actualEndDate: null,
          createdBy: 'user-1',
        },
      }),
    ).rejects.toThrow();
  }, 5_000);

  it('rejects an actual end date on an activity that is not COMPLETED', async () => {
    const executionId = await createExecution('exec-pending-date');

    await expect(
      prisma.scheduleActivity.create({
        data: {
          id: 'act-pending-date',
          processExecutionId: executionId,
          number: 1,
          activity: 'Actividad pendiente con fecha real',
          responsible: 'Presidente',
          status: 'PENDING',
          actualEndDate: new Date('2027-05-10T00:00:00.000Z'),
          createdBy: 'user-1',
        },
      }),
    ).rejects.toThrow();
  }, 5_000);

  it('keeps dates unchanged across time zones', async () => {
    const executionId = await createExecution('exec-tz');

    const activity = ScheduleActivity.create({
      id: 'act-tz',
      executionId,
      number: 1,
      activity: 'Actividad con fecha límite',
      responsible: 'Presidente',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
      actorId: 'user-1',
      now: NOW,
    })
      .start({ actorId: 'user-1', now: NOW })
      .complete({
        actualEndDate: '2027-06-30',
        today: '2027-07-01',
        actorId: 'user-1',
        now: NOW,
      });

    await repository.insertMany([activity]);
    const loaded = await repository.findByExecutionId(executionId);

    expect(loaded[0]?.startDate).toBe('2027-01-01');
    expect(loaded[0]?.endDate).toBe('2027-12-31');
    expect(loaded[0]?.actualEndDate).toBe('2027-06-30');
  }, 5_000);

  it('deletes only the given ids', async () => {
    const executionId = await createExecution('exec-del');

    const a1 = ScheduleActivity.create({
      id: 'act-del-1',
      executionId,
      number: 1,
      activity: 'Actividad 1',
      responsible: 'Presidente',
      actorId: 'user-1',
      now: NOW,
    });
    const a2 = ScheduleActivity.create({
      id: 'act-del-2',
      executionId,
      number: 2,
      activity: 'Actividad 2',
      responsible: 'Presidente',
      actorId: 'user-1',
      now: NOW,
    });

    await repository.insertMany([a1, a2]);
    await repository.deleteMany(['act-del-1']);

    const remaining = await repository.findByExecutionId(executionId);
    expect(remaining.map((item) => item.id)).toEqual(['act-del-2']);
  }, 5_000);

  it('restricts deleting an execution that has activities', async () => {
    const executionId = await createExecution('exec-restrict');

    const a1 = ScheduleActivity.create({
      id: 'act-res-1',
      executionId,
      number: 1,
      activity: 'Actividad protegida',
      responsible: 'Presidente',
      actorId: 'user-1',
      now: NOW,
    });
    await repository.insertMany([a1]);

    await expect(prisma.processExecution.delete({ where: { id: executionId } })).rejects.toThrow();
  }, 5_000);

  it('lockById returns null for an unknown execution', async () => {
    const locked = await uow.run(() => locker.lockById('missing-execution'));
    expect(locked).toBeNull();
  }, 5_000);

  it('returns the activity by id', async () => {
    const executionId = await createExecution('exec-find-id');

    const activity = ScheduleActivity.create({
      id: 'act-find-1',
      executionId,
      number: 1,
      activity: 'Actividad consultada',
      responsible: 'Presidente',
      actorId: 'user-1',
      now: NOW,
    });
    await repository.insertMany([activity]);

    const found = await repository.findById('act-find-1');
    expect(found?.id).toBe('act-find-1');
    expect(found?.activity).toBe('Actividad consultada');
  }, 5_000);

  it('returns null for an unknown id', async () => {
    const found = await repository.findById('missing-activity');
    expect(found).toBeNull();
  }, 5_000);

  it('serializes two concurrent proposals so exactly one inserts', async () => {
    const executionId = await createExecution('exec-conc-propose');

    const runProposal = async (prefix: string) =>
      uow.run(async () => {
        const locked = await locker.lockById(executionId);
        expect(locked?.id).toBe(executionId);

        const existing = await repository.findByExecutionId(executionId);
        if (existing.length > 0) {
          throw new ScheduleAlreadyDefinedError();
        }

        const item = ScheduleActivity.create({
          id: `${prefix}-1`,
          executionId,
          number: 1,
          activity: 'Paso 1',
          responsible: 'Presidente',
          actorId: 'user-1',
          now: NOW,
        });
        await repository.insertMany([item]);
      });

    const results = await Promise.allSettled([runProposal('p1'), runProposal('p2')]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ScheduleAlreadyDefinedError);

    const saved = await repository.findByExecutionId(executionId);
    expect(saved).toHaveLength(1);
  }, 5_000);

  it('serializes two concurrent savers with lockById', async () => {
    const executionId = await createExecution('exec-conc-save');

    const runSave = async (label: string, prefix: string) =>
      uow.run(async () => {
        const locked = await locker.lockById(executionId);
        expect(locked?.id).toBe(executionId);

        const existing = await repository.findByExecutionId(executionId);
        if (existing.length > 0) {
          await repository.deleteMany(existing.map((item) => item.id));
        }

        const first = ScheduleActivity.create({
          id: `${prefix}-1`,
          executionId,
          number: 1,
          activity: `${label} 1`,
          responsible: 'Presidente',
          actorId: 'user-1',
          now: NOW,
        });
        const second = ScheduleActivity.create({
          id: `${prefix}-2`,
          executionId,
          number: 2,
          activity: `${label} 2`,
          responsible: 'Presidente',
          actorId: 'user-1',
          now: NOW,
        });
        await repository.insertMany([first, second]);
      });

    const results = await Promise.allSettled([
      runSave('Conjunto A', 'a'),
      runSave('Conjunto B', 'b'),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const finalItems = await repository.findByExecutionId(executionId);
    expect(finalItems).toHaveLength(2);
    const prefixes = new Set(finalItems.map((item) => item.id.split('-')[0]));
    expect(prefixes.size).toBe(1);
  }, 5_000);
});
