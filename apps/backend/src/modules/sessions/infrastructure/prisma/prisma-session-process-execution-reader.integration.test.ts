import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaSessionProcessExecutionReader } from './prisma-session-process-execution-reader.js';

describe('PrismaSessionProcessExecutionReader Integration (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const reader = new PrismaSessionProcessExecutionReader(uow);

  async function seedExecution(id = 'exec-1') {
    await prisma.program.create({
      data: {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
    await prisma.catalogVersion.create({
      data: {
        id: 'cv-1',
        programId: 'prog-1',
        number: 1,
        status: 'APPROVED',
      },
    });
    await prisma.processExecution.create({
      data: {
        id,
        programId: 'prog-1',
        type: 'P612',
        name: 'Medición anual de OE 2027',
        year: 2027,
        catalogVersionId: 'cv-1',
        status: 'IN_PROGRESS',
        createdBy: 'user-1',
      },
    });
  }

  it('returns the same refs as before', async () => {
    await seedExecution('exec-1');

    expect(await reader.findByIds([])).toEqual([]);
    expect(await reader.findByIds(['exec-1'])).toEqual([
      {
        id: 'exec-1',
        name: 'Medición anual de OE 2027',
        status: 'IN_PROGRESS',
      },
    ]);
  }, 5_000);

  it('locks the linked executions with FOR SHARE so a void waits for an in-flight session edit', async () => {
    await seedExecution('exec-lock');

    let markLocked!: () => void;
    const lockedPromise = new Promise<void>((resolve) => {
      markLocked = resolve;
    });

    let releaseTransaction!: () => void;
    const releasePromise = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });

    const sessionTx = uow.run(async () => {
      const refs = await reader.findByIds(['exec-lock']);
      expect(refs).toHaveLength(1);
      markLocked();
      await releasePromise;
    });

    await lockedPromise;

    await expect(
      prisma.$queryRaw`
        SELECT "id"
        FROM "process_executions"
        WHERE "id" = 'exec-lock'
        FOR UPDATE NOWAIT
      `,
    ).rejects.toThrow();

    releaseTransaction();
    await sessionTx;
  }, 5_000);
});
