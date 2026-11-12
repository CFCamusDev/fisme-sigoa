import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/client.js';
import { useTestDatabase } from '../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from './prisma-unit-of-work.js';

describe('PrismaUnitOfWork Integration (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS test_uow_aux (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS test_uow_aux;`);
  });

  it('commits multiple writes together within the same transaction', async () => {
    await uow.run(async () => {
      const db = uow.get() as PrismaClient;
      await db.$executeRawUnsafe(`
        INSERT INTO test_uow_aux (id, value) VALUES ('tx-1', 'Primer valor');
      `);
      await db.$executeRawUnsafe(`
        INSERT INTO test_uow_aux (id, value) VALUES ('tx-2', 'Segundo valor');
      `);
    });

    const rows = await prisma.$queryRaw<Array<{ id: string; value: string }>>`
      SELECT id, value FROM test_uow_aux WHERE id IN ('tx-1', 'tx-2') ORDER BY id ASC;
    `;

    expect(rows.length).toBe(2);
    expect(rows[0]?.value).toBe('Primer valor');
    expect(rows[1]?.value).toBe('Segundo valor');
  });

  it('rolls back all writes if an error occurs during the transaction', async () => {
    const action = uow.run(async () => {
      const db = uow.get() as PrismaClient;
      await db.$executeRawUnsafe(`
        INSERT INTO test_uow_aux (id, value) VALUES ('tx-rollback', 'Valor previo');
      `);
      throw new Error('Fallo crítico forzado dentro de la transacción');
    });

    await expect(action).rejects.toThrow('Fallo crítico forzado dentro de la transacción');

    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM test_uow_aux WHERE id = 'tx-rollback';
    `;
    expect(Number(result[0]?.count)).toBe(0);
  });

  it('joins nested run() calls into the existing parent transaction', async () => {
    await expect(
      uow.run(async () => {
        const db = uow.get() as PrismaClient;
        await db.$executeRawUnsafe(`
          INSERT INTO test_uow_aux (id, value) VALUES ('outer-1', 'Valor exterior');
        `);

        // Llamada anidada que falla
        await uow.run(async () => {
          const innerDb = uow.get() as PrismaClient;
          await innerDb.$executeRawUnsafe(`
            INSERT INTO test_uow_aux (id, value) VALUES ('inner-1', 'Valor interior');
          `);
          throw new Error('Error en transacción anidada');
        });
      }),
    ).rejects.toThrow('Error en transacción anidada');

    // Ninguna de las dos inserciones debe haberse confirmado
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM test_uow_aux WHERE id IN ('outer-1', 'inner-1');
    `;
    expect(Number(result[0]?.count)).toBe(0);
  });

  it('executes concurrent transactions without inter-transaction interference', async () => {
    await Promise.all([
      uow.run(async () => {
        const db = uow.get() as PrismaClient;
        await db.$executeRawUnsafe(`
          INSERT INTO test_uow_aux (id, value) VALUES ('concurrent-a', 'Valor A');
        `);
      }),
      uow.run(async () => {
        const db = uow.get() as PrismaClient;
        await db.$executeRawUnsafe(`
          INSERT INTO test_uow_aux (id, value) VALUES ('concurrent-b', 'Valor B');
        `);
      }),
    ]);

    const result = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM test_uow_aux WHERE id IN ('concurrent-a', 'concurrent-b') ORDER BY id ASC;
    `;
    expect(result.length).toBe(2);
  });
});
