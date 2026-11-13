import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../db/use-test-database.js';
import { createCatalogFixture } from './catalog.js';

describe('createCatalogFixture (PostgreSQL real, T-013-22)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('creates the program and an approved version 1 with the requested items', async () => {
    const fixture = await createCatalogFixture(prisma, { objectiveCount: 2, attributeCount: 3 });

    expect(fixture.currentVersionId).not.toBeNull();
    const version = await prisma.catalogVersion.findUniqueOrThrow({
      where: { id: fixture.currentVersionId as string },
    });
    expect(version).toMatchObject({ number: 1, status: 'APPROVED', programId: fixture.programId });
    expect(await prisma.educationalObjective.count({ where: { versionId: version.id } })).toBe(2);
    expect(await prisma.graduateAttribute.count({ where: { versionId: version.id } })).toBe(3);
  }, 15_000);

  it('creates only the program when there must be no current version', async () => {
    const fixture = await createCatalogFixture(prisma, { withCurrentVersion: false });

    expect(fixture.currentVersionId).toBeNull();
    expect(await prisma.program.count()).toBe(1);
    expect(await prisma.catalogVersion.count()).toBe(0);
  }, 15_000);
});
