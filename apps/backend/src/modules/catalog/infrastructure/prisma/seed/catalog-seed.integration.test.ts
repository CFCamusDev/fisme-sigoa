import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/db/use-test-database.js';
import { seedCatalogVersionDefaults } from './catalog-version-seed.js';

describe('seedCatalogVersionDefaults Integration (PostgreSQL real, T-013-11)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  async function program(id = 'p1') {
    return prisma.program.create({
      data: { id, code: `EPIS-${id}`, name: 'Programa', faculty: 'FISME' },
    });
  }

  it('seeds version 1 as current with 4 objectives and 12 attributes', async () => {
    await program();

    await seedCatalogVersionDefaults(prisma);

    const versions = await prisma.catalogVersion.findMany();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      programId: 'p1',
      number: 1,
      status: 'APPROVED',
      basedOnVersionId: null,
      createdBy: 'SEED',
    });
    const objectives = await prisma.educationalObjective.findMany({ orderBy: { order: 'asc' } });
    const attributes = await prisma.graduateAttribute.findMany({ orderBy: { order: 'asc' } });
    expect(objectives.map((item) => [item.order, item.code])).toEqual([
      [1, 'OEP1'],
      [2, 'OEP2'],
      [3, 'OEP3'],
      [4, 'OEP4'],
    ]);
    expect(attributes).toHaveLength(12);
    expect(attributes[0]?.code).toBe('AG-C01');
    expect(attributes[11]?.code).toBe('AG-C12');
    expect(objectives.every((item) => item.versionId === versions[0]?.id)).toBe(true);
  }, 15_000);

  it('is idempotent', async () => {
    await program();

    await seedCatalogVersionDefaults(prisma);
    await seedCatalogVersionDefaults(prisma);

    expect(await prisma.catalogVersion.count()).toBe(1);
    expect(await prisma.educationalObjective.count()).toBe(4);
    expect(await prisma.graduateAttribute.count()).toBe(12);
  }, 15_000);

  it('does not touch a program that already has versions', async () => {
    await program();
    await prisma.catalogVersion.create({
      data: { id: 'edited', programId: 'p1', number: 1, status: 'DRAFT' },
    });

    await seedCatalogVersionDefaults(prisma);

    const versions = await prisma.catalogVersion.findMany();
    expect(versions.map((item) => [item.id, item.status])).toEqual([['edited', 'DRAFT']]);
    expect(await prisma.educationalObjective.count()).toBe(0);
  }, 15_000);

  it('fails with a clear message when there is no program', async () => {
    await expect(seedCatalogVersionDefaults(prisma)).rejects.toThrow(/programa/);
  }, 15_000);
});
