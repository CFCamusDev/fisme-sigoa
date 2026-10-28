import { describe, expect, it, afterEach } from 'vitest';
import { createPrismaClient, disconnectPrisma, getPrismaClient } from './prisma-client.js';
import { createTestEnv } from '../../test/test-env.js';

describe('PrismaClient factory and singleton', () => {
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

  it('createPrismaClient returns isolated independent instances with pool and disconnect', async () => {
    const instanceA = createPrismaClient('postgresql://user_a:pass@localhost:5432/test_db');
    const instanceB = createPrismaClient('postgresql://user_b:pass@localhost:5432/test_db');

    expect(instanceA.prisma).toBeDefined();
    expect(instanceB.prisma).toBeDefined();
    expect(instanceA.prisma).not.toBe(instanceB.prisma);
    expect(instanceA.pool).not.toBe(instanceB.pool);

    await instanceA.disconnect();
    await instanceB.disconnect();
  });
});
