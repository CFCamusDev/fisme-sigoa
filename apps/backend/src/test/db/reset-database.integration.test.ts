import { afterEach, describe, expect, it, vi } from 'vitest';
import { seedAuthorizationFast } from '../factories/authorization-fast.js';
import { resetDatabase } from './reset-database.js';
import { useTestDatabase } from './use-test-database.js';

describe('resetDatabase (T-078-06)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function countDirtyRows(): Promise<number> {
    const [roles, permissions, grants] = await Promise.all([
      prisma.role.count(),
      prisma.permission.count(),
      prisma.rolePermission.count(),
    ]);
    return roles + permissions + grants;
  }

  it('dirties several tables in one test', async () => {
    await seedAuthorizationFast(prisma);
    expect(await countDirtyRows()).toBeGreaterThan(0);
  });

  it('finds the tables empty in the next test', async () => {
    expect(await countDirtyRows()).toBe(0);
  });

  it('empties dirty tables without touching the migrations table', async () => {
    await seedAuthorizationFast(prisma);
    const migrationsBefore = await prisma.$queryRaw<
      Array<{ total: bigint }>
    >`SELECT count(*) AS total FROM "_prisma_migrations"`;

    await resetDatabase();

    expect(await countDirtyRows()).toBe(0);
    const migrationsAfter = await prisma.$queryRaw<
      Array<{ total: bigint }>
    >`SELECT count(*) AS total FROM "_prisma_migrations"`;
    expect(migrationsAfter[0]?.total).toBe(migrationsBefore[0]?.total);
  });

  it('is a no-op on an already empty database', async () => {
    await resetDatabase();
    await resetDatabase();
    expect(await countDirtyRows()).toBe(0);
  });

  it('empties everything with TEST_DB_RESET=truncate as well', async () => {
    vi.stubEnv('TEST_DB_RESET', 'truncate');
    await seedAuthorizationFast(prisma);

    await resetDatabase();

    expect(await countDirtyRows()).toBe(0);
  });
});
