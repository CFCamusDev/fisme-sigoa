import { describe, it, expect, vi } from 'vitest';
import { runSeed, type SeedStep, type SeedRunnerOptions } from './seed-runner.js';

interface FakeDb {
  records: Map<string, { id: string; name: string }>;
  transactionCommitted: boolean;
  transactionRolledBack: boolean;
}

function createFakeDb(): FakeDb {
  return {
    records: new Map(),
    transactionCommitted: false,
    transactionRolledBack: false,
  };
}

function createFakeTransactionRunner(db: FakeDb) {
  return async <T>(fn: (transactionClient: FakeDb) => Promise<T>): Promise<T> => {
    try {
      const result = await fn(db);
      db.transactionCommitted = true;
      return result;
    } catch (error) {
      db.transactionRolledBack = true;
      throw error;
    }
  };
}

describe('runSeed', () => {
  it('runs steps in declared order inside one transaction', async () => {
    const db = createFakeDb();
    const executionOrder: string[] = [];
    const transaction = createFakeTransactionRunner(db);

    const step1: SeedStep<FakeDb> = {
      id: '01-first',
      run: async (tx) => {
        executionOrder.push('step1');
        tx.records.set('1', { id: '1', name: 'First' });
      },
    };

    const step2: SeedStep<FakeDb> = {
      id: '02-second',
      run: async (tx) => {
        executionOrder.push('step2');
        tx.records.set('2', { id: '2', name: 'Second' });
      },
    };

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    await runSeed({
      steps: [step1, step2],
      transaction,
      logger,
    });

    expect(executionOrder).toEqual(['step1', 'step2']);
    expect(db.records.get('1')).toEqual({ id: '1', name: 'First' });
    expect(db.records.get('2')).toEqual({ id: '2', name: 'Second' });
    expect(db.transactionCommitted).toBe(true);
    expect(db.transactionRolledBack).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('01-first'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('02-second'));
  });

  it('running twice with upsert steps leaves the same state', async () => {
    const db = createFakeDb();
    const transaction = createFakeTransactionRunner(db);

    const upsertStep: SeedStep<FakeDb> = {
      id: '01-upsert-user',
      run: async (tx) => {
        // Simula upsert idempotente
        tx.records.set('admin', { id: 'admin', name: 'Admin User' });
      },
    };

    const options: SeedRunnerOptions<FakeDb> = {
      steps: [upsertStep],
      transaction,
    };

    await runSeed(options);
    const countFirstRun = db.records.size;

    await runSeed(options);
    const countSecondRun = db.records.size;

    expect(countFirstRun).toBe(1);
    expect(countSecondRun).toBe(1);
    expect(db.records.get('admin')).toEqual({ id: 'admin', name: 'Admin User' });
  });

  it('rejects duplicate step ids', async () => {
    const db = createFakeDb();
    const transaction = createFakeTransactionRunner(db);

    const step1: SeedStep<FakeDb> = {
      id: 'same-id',
      run: async () => {},
    };
    const step2: SeedStep<FakeDb> = {
      id: 'same-id',
      run: async () => {},
    };

    await expect(
      runSeed({
        steps: [step1, step2],
        transaction,
      }),
    ).rejects.toThrow(/duplicate.*same-id/i);
    expect(db.transactionCommitted).toBe(false);
  });

  it('stops and reports the step id when a step fails', async () => {
    const db = createFakeDb();
    const transaction = createFakeTransactionRunner(db);
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const step1: SeedStep<FakeDb> = {
      id: '01-success',
      run: async (tx) => {
        tx.records.set('1', { id: '1', name: 'One' });
      },
    };
    const step2: SeedStep<FakeDb> = {
      id: '02-failure',
      run: async () => {
        throw new Error('Database connection dropped');
      },
    };
    const step3: SeedStep<FakeDb> = {
      id: '03-unreachable',
      run: async () => {},
    };

    await expect(
      runSeed({
        steps: [step1, step2, step3],
        transaction,
        logger,
      }),
    ).rejects.toThrow(/Database connection dropped/);

    expect(db.transactionRolledBack).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('02-failure'),
      expect.anything(),
    );
  });

  it('finishes without error when there are no steps', async () => {
    const db = createFakeDb();
    const transaction = createFakeTransactionRunner(db);
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    await runSeed({
      steps: [],
      transaction,
      logger,
    });

    expect(db.records.size).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No seed steps'));
  });
});
