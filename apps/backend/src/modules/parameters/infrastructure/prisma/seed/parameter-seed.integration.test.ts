import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/db/use-test-database.js';
import { seedParameterDefaults } from './parameter-seed.js';

describe('Parameter Seed Integration (PostgreSQL real, HU-011, T-011-07, RF-011)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  async function defaults(): Promise<Record<string, number>> {
    const rows = await prisma.parameter.findMany({
      where: { effectiveFromSemesterId: null },
      orderBy: { key: 'asc' },
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  it('seeds the seven default parameters idempotently', async () => {
    await seedParameterDefaults(prisma);
    await seedParameterDefaults(prisma);
    await seedParameterDefaults(prisma);

    expect(await prisma.parameter.count()).toBe(7);
    expect(await defaults()).toEqual({
      LOGIN_INTENTOS: 5,
      META_AG: 70,
      MIN_PARTICIPACION: 3,
      PESO_DIRECTA: 70,
      PESO_INDIRECTA: 30,
      TOKEN_DIAS: 7,
      UMBRAL_LOGRADO: 14,
    });
    const row = await prisma.parameter.findFirstOrThrow({ where: { key: 'META_AG' } });
    expect(row).toMatchObject({ createdBy: 'SEED', updatedBy: 'SEED' });
  }, 15_000);

  it('does not overwrite an edited default value', async () => {
    await prisma.parameter.create({ data: { key: 'META_AG', value: 85, createdBy: 'ADMIN' } });

    await seedParameterDefaults(prisma);

    expect(await prisma.parameter.count()).toBe(7);
    const row = await prisma.parameter.findFirstOrThrow({ where: { key: 'META_AG' } });
    expect(row.value).toBe(85);
    expect(row.createdBy).toBe('ADMIN');
  }, 15_000);

  it('does not touch versions defined for a semester', async () => {
    const semester = await prisma.semester.create({
      data: {
        code: '2027-I',
        startDate: new Date('2027-03-01T00:00:00.000Z'),
        endDate: new Date('2027-07-31T00:00:00.000Z'),
      },
    });
    await prisma.parameter.create({
      data: { key: 'META_AG', value: 80, effectiveFromSemesterId: semester.id },
    });

    await seedParameterDefaults(prisma);

    expect(await prisma.parameter.count()).toBe(8);
    expect((await defaults()).META_AG).toBe(70);
  }, 15_000);
});
