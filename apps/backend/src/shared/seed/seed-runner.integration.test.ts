import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../prisma/generated/client.js';
import { useTestDatabase } from '../../test/db/use-test-database.js';
import { runSeed, type SeedStep } from './seed-runner.js';

describe('SeedRunner Integration (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS test_seed_aux (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS test_seed_aux;`);
  });

  it('executes idempotently: running seed steps twice leaves exactly one record', async () => {
    const idempotentStep: SeedStep<PrismaClient> = {
      id: 'idempotent-seed-step-1',
      run: async (tx: PrismaClient) => {
        await tx.$executeRawUnsafe(`
          INSERT INTO test_seed_aux (id, name)
          VALUES ('seed-item-1', 'Nombre inicial')
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
        `);
      },
    };

    const runSeedWithOptions = async () =>
      runSeed({
        steps: [idempotentStep],
        transaction: async (fn) =>
          prisma.$transaction(async (tx) => fn(tx as unknown as PrismaClient)),
      });

    // Primera ejecución
    await runSeedWithOptions();

    const countAfterFirst = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM test_seed_aux WHERE id = 'seed-item-1';
    `;
    expect(Number(countAfterFirst[0]?.count)).toBe(1);

    // Segunda ejecución (idempotente)
    await runSeedWithOptions();

    const countAfterSecond = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM test_seed_aux WHERE id = 'seed-item-1';
    `;
    expect(Number(countAfterSecond[0]?.count)).toBe(1);
  });

  it('rolls back the entire transaction if a subsequent seed step fails', async () => {
    const step1: SeedStep<PrismaClient> = {
      id: 'step-insert-row',
      run: async (tx: PrismaClient) => {
        await tx.$executeRawUnsafe(`
          INSERT INTO test_seed_aux (id, name)
          VALUES ('rollback-item', 'Fila transaccional');
        `);
      },
    };

    const step2: SeedStep<PrismaClient> = {
      id: 'step-failing',
      run: async () => {
        throw new Error('Fallo provocado en paso 2');
      },
    };

    await expect(
      runSeed({
        steps: [step1, step2],
        transaction: async (fn) =>
          prisma.$transaction(async (tx) => fn(tx as unknown as PrismaClient)),
      }),
    ).rejects.toThrow('Fallo provocado en paso 2');

    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM test_seed_aux WHERE id = 'rollback-item';
    `;
    expect(Number(result[0]?.count)).toBe(0);
  });
});
