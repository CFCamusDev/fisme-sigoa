import { beforeEach, describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import type { ScaleLevel } from '../../domain/entities/response-scale.js';
import { PrismaScaleLevelRepository } from './prisma-scale-level-repository.js';

describe('PrismaScaleLevelRepository Integration (PostgreSQL real, T-012-23)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaScaleLevelRepository(uow);

  const level = (order: number, label: string, value: number, counts = false): ScaleLevel => ({
    order,
    label,
    value,
    countsAsAchievement: counts,
  });

  async function levelsOf(scaleId: string) {
    return prisma.scaleLevel.findMany({ where: { scaleId }, orderBy: { order: 'asc' } });
  }

  beforeEach(async () => {
    await prisma.responseScale.create({
      data: { id: 'scale_1', code: 'LIKERT_5', name: 'Likert 5', type: 'LIKERT' },
    });
    await prisma.responseScale.create({
      data: { id: 'scale_2', code: 'EVIDENCE_4', name: 'Evidencia 4', type: 'EVIDENCE' },
    });
  });

  it('inserts every level with its order, value and counts-as-achievement flag', async () => {
    await uow.run(() =>
      repository.replaceLevels('scale_1', [
        level(1, 'Bajo', 1),
        level(2, 'Medio', 2),
        level(3, 'Alto', 3, true),
      ]),
    );

    const rows = await levelsOf('scale_1');
    expect(rows.map((row) => [row.order, row.label, row.value, row.countsAsAchievement])).toEqual([
      [1, 'Bajo', 1, false],
      [2, 'Medio', 2, false],
      [3, 'Alto', 3, true],
    ]);
  }, 15_000);

  it('replaces the previous levels completely, even when order and value are reused', async () => {
    await uow.run(() =>
      repository.replaceLevels('scale_1', [level(1, 'Viejo A', 1), level(2, 'Viejo B', 2, true)]),
    );

    await uow.run(() =>
      repository.replaceLevels('scale_1', [
        level(1, 'Nuevo A', 2, true),
        level(2, 'Nuevo B', 1),
        level(3, 'Nuevo C', 3),
      ]),
    );

    const rows = await levelsOf('scale_1');
    expect(rows.map((row) => [row.order, row.label, row.value, row.countsAsAchievement])).toEqual([
      [1, 'Nuevo A', 2, true],
      [2, 'Nuevo B', 1, false],
      [3, 'Nuevo C', 3, false],
    ]);
  }, 15_000);

  it('does not touch the levels of another scale', async () => {
    await uow.run(async () => {
      await repository.replaceLevels('scale_1', [level(1, 'Uno', 1), level(2, 'Dos', 2)]);
      await repository.replaceLevels('scale_2', [level(1, 'Uno', 1), level(2, 'Dos', 2)]);
    });

    await uow.run(() =>
      repository.replaceLevels('scale_1', [level(1, 'Solo', 5), level(2, 'Otro', 6)]),
    );

    expect((await levelsOf('scale_2')).map((row) => row.label)).toEqual(['Uno', 'Dos']);
    expect((await levelsOf('scale_1')).map((row) => row.label)).toEqual(['Solo', 'Otro']);
  }, 15_000);

  it('refuses to run outside a transaction and changes nothing', async () => {
    await uow.run(() => repository.replaceLevels('scale_1', [level(1, 'A', 1), level(2, 'B', 2)]));

    await expect(
      repository.replaceLevels('scale_1', [level(1, 'X', 1), level(2, 'Y', 2)]),
    ).rejects.toThrow(/transacción activa/);

    expect((await levelsOf('scale_1')).map((row) => row.label)).toEqual(['A', 'B']);
  }, 15_000);

  it('rolls back the deletion when the new levels violate a constraint', async () => {
    await uow.run(() => repository.replaceLevels('scale_1', [level(1, 'A', 1), level(2, 'B', 2)]));

    await expect(
      uow.run(() => repository.replaceLevels('scale_1', [level(1, 'X', 1), level(2, 'Y', 1)])),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect((await levelsOf('scale_1')).map((row) => row.label)).toEqual(['A', 'B']);
  }, 15_000);

  it('enforces unique order and value per scale and the CHECK constraints in the database', async () => {
    const base = { scaleId: 'scale_1', countsAsAchievement: false };
    await prisma.scaleLevel.create({ data: { ...base, order: 1, label: 'A', value: 1 } });

    await expect(
      prisma.scaleLevel.create({ data: { ...base, order: 1, label: 'B', value: 2 } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      prisma.scaleLevel.create({ data: { ...base, order: 2, label: 'B', value: 1 } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      prisma.scaleLevel.create({ data: { ...base, order: 0, label: 'B', value: 2 } }),
    ).rejects.toThrow();
    await expect(
      prisma.scaleLevel.create({ data: { ...base, order: 2, label: 'B', value: 101 } }),
    ).rejects.toThrow();
    await expect(
      prisma.scaleLevel.create({ data: { ...base, order: 2, label: '  ', value: 2 } }),
    ).rejects.toThrow();
    expect(await levelsOf('scale_1')).toHaveLength(1);
  }, 15_000);

  it('allows the same order and value in different scales', async () => {
    await uow.run(async () => {
      await repository.replaceLevels('scale_1', [level(1, 'A', 1), level(2, 'B', 2)]);
      await repository.replaceLevels('scale_2', [level(1, 'A', 1), level(2, 'B', 2)]);
    });

    expect(await prisma.scaleLevel.count()).toBe(4);
  }, 15_000);

  it('does not let a scale with levels be deleted (ON DELETE RESTRICT)', async () => {
    await uow.run(() => repository.replaceLevels('scale_1', [level(1, 'A', 1), level(2, 'B', 2)]));

    await expect(prisma.responseScale.delete({ where: { id: 'scale_1' } })).rejects.toThrow();
    expect(await prisma.responseScale.count({ where: { id: 'scale_1' } })).toBe(1);
  }, 15_000);
});
