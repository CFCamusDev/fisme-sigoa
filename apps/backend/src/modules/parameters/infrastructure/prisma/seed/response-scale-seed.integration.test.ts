import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/db/use-test-database.js';
import { seedResponseScaleDefaults } from './response-scale-seed.js';

describe('Response Scale Seed Integration (PostgreSQL real, HU-012, T-012-09, RF-012, CA1, CA2)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  async function levelsOf(code: string) {
    const rows = await prisma.scaleLevel.findMany({
      where: { scale: { code } },
      orderBy: { order: 'asc' },
    });
    return rows.map((row) => [row.order, row.label, row.value, row.countsAsAchievement]);
  }

  it('seeds the three scales with their levels idempotently', async () => {
    await seedResponseScaleDefaults(prisma);
    await seedResponseScaleDefaults(prisma);
    await seedResponseScaleDefaults(prisma);

    const scales = await prisma.responseScale.findMany({ orderBy: { code: 'asc' } });
    expect(scales.map((scale) => [scale.code, scale.type])).toEqual([
      ['EVIDENCE_4', 'EVIDENCE'],
      ['LIKERT_5', 'LIKERT'],
      ['NUMERIC_1_5', 'NUMERIC'],
    ]);
    expect(scales.every((scale) => scale.createdBy === 'SEED')).toBe(true);
    expect(await prisma.scaleLevel.count()).toBe(14);
    expect(await levelsOf('LIKERT_5')).toHaveLength(5);
    expect(await levelsOf('NUMERIC_1_5')).toHaveLength(5);
  }, 15_000);

  it('marks only totally and mostly as counting toward achievement', async () => {
    await seedResponseScaleDefaults(prisma);

    expect(await levelsOf('EVIDENCE_4')).toEqual([
      [1, 'Se evidencia totalmente', 4, true],
      [2, 'Se evidencia mayormente', 3, true],
      [3, 'Se evidencia parcialmente', 2, false],
      [4, 'No se evidencia en su desempeño', 1, false],
    ]);
    expect(await prisma.scaleLevel.count({ where: { countsAsAchievement: true } })).toBe(2);
  }, 15_000);

  it('does not overwrite an edited scale when seeding again', async () => {
    await seedResponseScaleDefaults(prisma);
    await prisma.responseScale.update({
      where: { code: 'EVIDENCE_4' },
      data: { name: 'Nombre editado', updatedBy: 'ADMIN' },
    });
    await prisma.scaleLevel.deleteMany({
      where: { scale: { code: 'EVIDENCE_4' }, order: { in: [3, 4] } },
    });

    await seedResponseScaleDefaults(prisma);

    const scale = await prisma.responseScale.findUniqueOrThrow({ where: { code: 'EVIDENCE_4' } });
    expect(scale).toMatchObject({ name: 'Nombre editado', updatedBy: 'ADMIN' });
    expect(await levelsOf('EVIDENCE_4')).toHaveLength(2);
    expect(await prisma.responseScale.count()).toBe(3);
  }, 15_000);

  it('only creates the scales that are missing', async () => {
    await prisma.responseScale.create({
      data: {
        code: 'LIKERT_5',
        name: 'Mi Likert',
        type: 'LIKERT',
        levels: {
          create: [
            { order: 1, label: 'Sí', value: 1, countsAsAchievement: false },
            { order: 2, label: 'No', value: 0, countsAsAchievement: false },
          ],
        },
      },
    });

    await seedResponseScaleDefaults(prisma);

    expect(await prisma.responseScale.count()).toBe(3);
    expect(await levelsOf('LIKERT_5')).toHaveLength(2);
    expect(await levelsOf('EVIDENCE_4')).toHaveLength(4);
  }, 15_000);
});
