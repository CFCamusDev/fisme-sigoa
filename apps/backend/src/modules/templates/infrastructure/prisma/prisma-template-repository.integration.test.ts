import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { InvalidTemplateDataError } from '../../domain/errors/index.js';
import { PrismaTemplateRepository } from './prisma-template-repository.js';

describe('PrismaTemplateRepository Integration (PostgreSQL real, T-018-24)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaTemplateRepository(uow);

  async function template(
    id: string,
    code: string,
    type: 'ANNEX' | 'MINUTES' | 'SURVEY' | 'INSTRUMENT' = 'ANNEX',
    variables: unknown = [],
  ) {
    return prisma.template.create({
      data: { id, code, name: `Plantilla ${code}`, type, variables: variables as never },
    });
  }

  it('finds a template by id and by code with its variables', async () => {
    await template('t1', 'FO-01', 'ANNEX', [{ key: 'programName', label: 'Programa' }]);

    const byId = await repository.findById('t1');
    const byCode = await repository.findByCode('FO-01');

    expect(byId?.code).toBe('FO-01');
    expect(byId?.type).toBe('ANNEX');
    expect(byId?.variables).toEqual([{ key: 'programName', label: 'Programa' }]);
    expect(byCode?.id).toBe('t1');
  }, 15_000);

  it('returns null when the template does not exist', async () => {
    expect(await repository.findById('missing')).toBeNull();
    expect(await repository.findByCode('NOPE-01')).toBeNull();
  }, 15_000);

  it('maps a template without variables to an empty list', async () => {
    await template('t1', 'FO-01');
    expect((await repository.findById('t1'))?.variables).toEqual([]);
  }, 15_000);

  it('lists the templates ordered by code with the total', async () => {
    await template('t3', 'FO-03');
    await template('t1', 'FO-01');
    await template('t2', 'ACTA', 'MINUTES');

    const page = await repository.list({ page: 1, pageSize: 50 });

    expect(page.items.map((item) => item.code)).toEqual(['ACTA', 'FO-01', 'FO-03']);
    expect(page.total).toBe(3);
  }, 15_000);

  it('paginates and keeps the total of the whole result', async () => {
    await template('t1', 'FO-01');
    await template('t2', 'FO-02');
    await template('t3', 'FO-03');

    const second = await repository.list({ page: 2, pageSize: 2 });
    const beyond = await repository.list({ page: 5, pageSize: 2 });

    expect(second.items.map((item) => item.code)).toEqual(['FO-03']);
    expect(second.total).toBe(3);
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(3);
  }, 15_000);

  it('filters by type', async () => {
    await template('t1', 'FO-01', 'ANNEX');
    await template('t2', 'ENC-A5', 'SURVEY');
    await template('t3', 'ENC-A6', 'SURVEY');

    const surveys = await repository.list({ type: 'SURVEY', page: 1, pageSize: 50 });
    const minutes = await repository.list({ type: 'MINUTES', page: 1, pageSize: 50 });

    expect(surveys.items.map((item) => item.code)).toEqual(['ENC-A5', 'ENC-A6']);
    expect(surveys.total).toBe(2);
    expect(minutes).toEqual({ items: [], total: 0 });
  }, 15_000);

  it('refuses lockForUpdate outside a transaction', async () => {
    await template('t1', 'FO-01');
    await expect(repository.lockForUpdate('t1')).rejects.toThrow(/transacción activa/);
  }, 15_000);

  it('locks and returns the template inside a transaction, or null when missing', async () => {
    await template('t1', 'FO-01');

    const [found, missing] = await uow.run(async () => [
      await repository.lockForUpdate('t1'),
      await repository.lockForUpdate('missing'),
    ]);

    expect(found?.code).toBe('FO-01');
    expect(missing).toBeNull();
  }, 15_000);

  it('serializes concurrent locks on the same template', async () => {
    await template('t1', 'FO-01');
    let firstHasLock!: () => void;
    const firstLocked = new Promise<void>((resolve) => (firstHasLock = resolve));
    let releaseFirst!: () => void;
    const firstMayCommit = new Promise<void>((resolve) => (releaseFirst = resolve));

    const first = uow.run(async () => {
      await repository.lockForUpdate('t1');
      firstHasLock();
      await firstMayCommit;
      await uow.get().template.update({ where: { id: 't1' }, data: { name: 'Renombrada' } });
    });
    await firstLocked;

    const second = uow.run(async () => (await repository.lockForUpdate('t1'))?.name);

    // La segunda transacción debe quedar esperando el bloqueo de fila de la primera.
    const deadline = Date.now() + 10_000;
    let waiting = 0;
    while (waiting === 0 && Date.now() < deadline) {
      const rows = await prisma.$queryRaw<Array<{ total: number }>>`
        SELECT count(*)::int AS total FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
      `;
      waiting = rows[0]?.total ?? 0;
    }
    expect(waiting).toBeGreaterThan(0);

    releaseFirst();
    await first;
    // Tras esperar, la segunda ve lo confirmado por la primera, no el nombre anterior.
    expect(await second).toBe('Renombrada');
  }, 20_000);

  it.each([
    ['a list with an invalid key', [{ key: 'Bad Key', label: 'X' }]],
    [
      'repeated keys',
      [
        { key: 'a', label: 'A' },
        { key: 'a', label: 'B' },
      ],
    ],
    ['a value that is not a list', { key: 'a', label: 'A' }],
    ['an unknown field', [{ key: 'a', label: 'A', extra: true }]],
  ])(
    'rejects a stored template with %s',
    async (_name, variables) => {
      await template('t1', 'FO-01', 'ANNEX', variables);

      await expect(repository.findById('t1')).rejects.toThrow(InvalidTemplateDataError);
      await expect(repository.list({ page: 1, pageSize: 50 })).rejects.toThrow(
        InvalidTemplateDataError,
      );
    },
    15_000,
  );

  it('rejects an empty template code at the database level', async () => {
    await expect(template('t1', '   ')).rejects.toThrow();
  }, 15_000);
});
