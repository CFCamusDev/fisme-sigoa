import { describe, expect, it, afterEach } from 'vitest';
import { getPrismaClient, disconnectPrisma } from './prisma-client.js';
import { createTestEnv } from '../../test/test-env.js';

describe('PrismaClient singleton', () => {
  const env = createTestEnv({
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
  });

  afterEach(async () => {
    await disconnectPrisma();
  });

  it('getPrismaClient returns the same instance on repeated calls', () => {
    const client1 = getPrismaClient(env);
    const client2 = getPrismaClient(env);

    expect(client1).toBe(client2);
  });

  it('disconnectPrisma allows a fresh instance afterwards', async () => {
    const client1 = getPrismaClient(env);
    await disconnectPrisma();
    const client2 = getPrismaClient(env);

    expect(client1).not.toBe(client2);
  });
});
