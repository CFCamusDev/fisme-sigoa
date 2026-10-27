import { describe, it, expect, vi } from 'vitest';
import { PrismaUnitOfWork } from './prisma-unit-of-work.js';
import type { PrismaClient } from './generated/client.js';

interface FakeClient {
  id: string;
  $transaction: <T>(fn: (tx: FakeClient) => Promise<T>) => Promise<T>;
}

function createFakePrismaClient(): FakeClient {
  const baseClient: FakeClient = {
    id: 'base-client',
    $transaction: async <T>(fn: (tx: FakeClient) => Promise<T>): Promise<T> => {
      const txClient: FakeClient = {
        id: `tx-${Math.random().toString(36).slice(2, 9)}`,
        $transaction: vi.fn(),
      };
      return await fn(txClient);
    },
  };
  return baseClient;
}

describe('PrismaUnitOfWork', () => {
  it('run executes the work inside a transaction', async () => {
    const fakeClient = createFakePrismaClient();
    const transactionSpy = vi.spyOn(fakeClient, '$transaction');
    const uow = new PrismaUnitOfWork(fakeClient as unknown as PrismaClient);

    const result = await uow.run(async () => {
      return 'work-done';
    });

    expect(result).toBe('work-done');
    expect(transactionSpy).toHaveBeenCalledTimes(1);
  });

  it('provider returns the transaction client inside run', async () => {
    const fakeClient = createFakePrismaClient();
    const uow = new PrismaUnitOfWork(fakeClient as unknown as PrismaClient);

    await uow.run(async () => {
      const client = uow.get();
      expect(client).not.toBe(fakeClient);
      expect((client as unknown as FakeClient).id).toMatch(/^tx-/);
    });
  });

  it('provider returns the base client outside run', () => {
    const fakeClient = createFakePrismaClient();
    const uow = new PrismaUnitOfWork(fakeClient as unknown as PrismaClient);

    const client = uow.get();
    expect(client).toBe(fakeClient);
    expect((client as unknown as FakeClient).id).toBe('base-client');
  });

  it('rolls back and rethrows the original error', async () => {
    const fakeClient = createFakePrismaClient();
    const uow = new PrismaUnitOfWork(fakeClient as unknown as PrismaClient);

    const testError = new Error('Database write failure');

    await expect(
      uow.run(async () => {
        throw testError;
      }),
    ).rejects.toThrow(testError);

    // Fuera del run vuelve al cliente base
    expect(uow.get()).toBe(fakeClient);
  });

  it('a nested run joins the current transaction', async () => {
    const fakeClient = createFakePrismaClient();
    const transactionSpy = vi.spyOn(fakeClient, '$transaction');
    const uow = new PrismaUnitOfWork(fakeClient as unknown as PrismaClient);

    let outerTxId: string | undefined;
    let innerTxId: string | undefined;

    const result = await uow.run(async () => {
      outerTxId = (uow.get() as unknown as FakeClient).id;

      return await uow.run(async () => {
        innerTxId = (uow.get() as unknown as FakeClient).id;
        return 'nested-success';
      });
    });

    expect(result).toBe('nested-success');
    expect(transactionSpy).toHaveBeenCalledTimes(1); // Solo abrió una transacción
    expect(outerTxId).toBeDefined();
    expect(innerTxId).toBe(outerTxId); // Misma transacción
  });

  it('concurrent runs do not share a transaction client', async () => {
    const fakeClient = createFakePrismaClient();
    const uow = new PrismaUnitOfWork(fakeClient as unknown as PrismaClient);

    let tx1Id: string | undefined;
    let tx2Id: string | undefined;

    await Promise.all([
      uow.run(async () => {
        // Simula trabajo con retraso
        await new Promise((resolve) => setTimeout(resolve, 20));
        tx1Id = (uow.get() as unknown as FakeClient).id;
      }),
      uow.run(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        tx2Id = (uow.get() as unknown as FakeClient).id;
      }),
    ]);

    expect(tx1Id).toBeDefined();
    expect(tx2Id).toBeDefined();
    expect(tx1Id).not.toBe(tx2Id);
  });
});
