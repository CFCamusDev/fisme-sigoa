import { afterAll, beforeEach } from 'vitest';
import { disconnectPrisma, getPrismaClient } from '../../shared/prisma/prisma-client.js';
import { createTestEnv } from '../test-env.js';
import { getTestDatabaseUrl } from './assert-test-database.js';
import { resetDatabase } from './reset-database.js';

export function useTestDatabase() {
  const databaseUrl = getTestDatabaseUrl();
  const testEnv = createTestEnv({ DATABASE_URL: databaseUrl });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  return {
    databaseUrl,
    testEnv,
    getPrisma: () => getPrismaClient(testEnv),
  };
}
