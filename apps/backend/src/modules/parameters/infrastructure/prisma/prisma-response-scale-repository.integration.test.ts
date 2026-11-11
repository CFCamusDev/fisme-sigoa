import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { ResponseScale, type ScaleType } from '../../domain/entities/response-scale.js';
import { ResponseScaleCodeAlreadyExistsError } from '../../domain/errors/index.js';
import { PrismaResponseScaleRepository } from './prisma-response-scale-repository.js';

describe('PrismaResponseScaleRepository Integration (PostgreSQL real, T-012-22)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaResponseScaleRepository(uow);

  function scale(id: string, code: string, type: ScaleType = 'LIKERT'): ResponseScale {
    return ResponseScale.create({
      id,
      code,
      name: `Escala ${code}`,
      type,
      levels: [
        { order: 1, label: 'Bajo', value: 1, countsAsAchievement: false },
        { order: 2, label: 'Alto', value: 2, countsAsAchievement: true },
      ],
      createdBy: 'admin-1',
      updatedBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async function seedScale(id: string, code: string, type: ScaleType, labels: string[]) {
    return prisma.responseScale.create({
      data: {
        id,
        code,
        name: `Escala ${code}`,
        type,
        levels: {
          create: labels.map((label, index) => ({
            order: index + 1,
            label,
            value: index + 1,
            countsAsAchievement: index === labels.length - 1,
          })),
        },
      },
    });
  }

  it('inserts the header and finds it by id and by code', async () => {
    await repository.save(scale('scale_1', 'LIKERT_5'));

    // La cabecera sola no tiene niveles: el mapeo exige 2 o más, así que se completan aparte.
    await prisma.scaleLevel.createMany({
      data: [
        { scaleId: 'scale_1', order: 1, label: 'Bajo', value: 1, countsAsAchievement: false },
        { scaleId: 'scale_1', order: 2, label: 'Alto', value: 2, countsAsAchievement: true },
      ],
    });

    const byCode = await repository.findByCode('LIKERT_5');
    const byId = await repository.findById('scale_1');
    expect(byCode?.id).toBe('scale_1');
    expect(byId?.type).toBe('LIKERT');
    expect(byId?.createdBy).toBe('admin-1');
    expect(await repository.findById('missing')).toBeNull();
    expect(await repository.findByCode('MISSING')).toBeNull();
  }, 15_000);

  it('lists every scale with its levels ordered by position and filters by type', async () => {
    await seedScale('s_1', 'LIKERT_5', 'LIKERT', ['Uno', 'Dos', 'Tres']);
    await seedScale('s_2', 'EVIDENCE_4', 'EVIDENCE', ['Nada', 'Todo']);
    // Niveles creados en desorden: el repositorio los devuelve por `order`.
    await prisma.scaleLevel.deleteMany({ where: { scaleId: 's_1' } });
    await prisma.scaleLevel.createMany({
      data: [
        { scaleId: 's_1', order: 3, label: 'Tres', value: 3, countsAsAchievement: true },
        { scaleId: 's_1', order: 1, label: 'Uno', value: 1, countsAsAchievement: false },
        { scaleId: 's_1', order: 2, label: 'Dos', value: 2, countsAsAchievement: false },
      ],
    });

    const all = await repository.list();
    const likert = all.find((item) => item.code === 'LIKERT_5');
    expect(all.map((item) => item.code).sort()).toEqual(['EVIDENCE_4', 'LIKERT_5']);
    expect(likert?.levels.map((level) => level.label)).toEqual(['Uno', 'Dos', 'Tres']);
    expect(likert?.levels.map((level) => level.countsAsAchievement)).toEqual([false, false, true]);

    const onlyEvidence = await repository.list({ type: 'EVIDENCE' });
    expect(onlyEvidence.map((item) => item.code)).toEqual(['EVIDENCE_4']);
  }, 15_000);

  it('updates the name and the editor of an existing scale without touching code or type', async () => {
    await seedScale('s_1', 'LIKERT_5', 'LIKERT', ['Uno', 'Dos']);
    const loaded = (await repository.findById('s_1'))!;

    loaded.rename('Nombre nuevo', 'editor-1');
    await repository.save(loaded);

    const row = await prisma.responseScale.findUniqueOrThrow({ where: { id: 's_1' } });
    expect(row.name).toBe('Nombre nuevo');
    expect(row.updatedBy).toBe('editor-1');
    expect(row.code).toBe('LIKERT_5');
    expect(row.type).toBe('LIKERT');
  }, 15_000);

  it('translates a duplicated code into ResponseScaleCodeAlreadyExistsError', async () => {
    await repository.save(scale('scale_1', 'LIKERT_5'));

    await expect(repository.save(scale('scale_2', 'LIKERT_5'))).rejects.toBeInstanceOf(
      ResponseScaleCodeAlreadyExistsError,
    );
    expect(await prisma.responseScale.count()).toBe(1);
  }, 15_000);

  it('keeps one row and reports one conflict when two inserts use the same code at once', async () => {
    const results = await Promise.allSettled([
      repository.save(scale('scale_a', 'LIKERT_5')),
      repository.save(scale('scale_b', 'LIKERT_5')),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ResponseScaleCodeAlreadyExistsError);
    expect(await prisma.responseScale.count({ where: { code: 'LIKERT_5' } })).toBe(1);
  }, 15_000);

  it('refuses lockById outside a transaction', async () => {
    await seedScale('s_1', 'LIKERT_5', 'LIKERT', ['Uno', 'Dos']);

    await expect(repository.lockById('s_1')).rejects.toThrow(/transacción activa/);
  }, 15_000);

  it('returns the scale with its levels from lockById inside a transaction, or null if missing', async () => {
    await seedScale('s_1', 'LIKERT_5', 'LIKERT', ['Uno', 'Dos']);

    const [found, missing] = await uow.run(async () => [
      await repository.lockById('s_1'),
      await repository.lockById('missing'),
    ]);

    expect(found?.levels).toHaveLength(2);
    expect(missing).toBeNull();
  }, 15_000);

  it('rejects invalid rows through the CHECK constraints', async () => {
    await expect(
      prisma.responseScale.create({ data: { code: 'lower', name: 'X', type: 'LIKERT' } }),
    ).rejects.toThrow();
    await expect(
      prisma.responseScale.create({ data: { code: 'GOOD_CODE', name: '   ', type: 'LIKERT' } }),
    ).rejects.toThrow();
  }, 15_000);
});
