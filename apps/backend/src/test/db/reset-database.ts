import { getPrismaClient } from '../../shared/prisma/prisma-client.js';
import { createTestEnv } from '../test-env.js';
import { getTestDatabaseUrl } from './assert-test-database.js';

export async function resetDatabase(): Promise<void> {
  const databaseUrl = getTestDatabaseUrl();
  const testEnv = createTestEnv({ DATABASE_URL: databaseUrl });
  const prisma = getPrismaClient(testEnv);

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
  `;

  if (tables.length > 0) {
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
  }
}
