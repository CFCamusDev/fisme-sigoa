import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import {
  CatalogVersion,
  type CatalogVersionStatus,
} from '../../domain/entities/catalog-version.js';
import {
  CatalogVersionNumberConflictError,
  OpenCatalogVersionExistsError,
} from '../../domain/errors/index.js';
import { PrismaCatalogProgramReader } from './prisma-catalog-program-reader.js';
import { PrismaCatalogVersionRepository } from './prisma-catalog-version-repository.js';

describe('PrismaCatalogVersionRepository Integration (PostgreSQL real, T-013-19)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaCatalogVersionRepository(uow);

  async function program(id: string) {
    return prisma.program.create({
      data: { id, code: `EPIS-${id}`, name: `Programa ${id}`, faculty: 'FISME' },
    });
  }

  function draft(id: string, programId: string, number: number, basedOnVersionId?: string) {
    return CatalogVersion.createDraft({
      id,
      programId,
      number,
      basedOnVersionId,
      actorId: 'user-1',
    });
  }

  async function seedVersion(
    id: string,
    programId: string,
    number: number,
    status: CatalogVersionStatus,
  ) {
    return prisma.catalogVersion.create({ data: { id, programId, number, status } });
  }

  it('inserts a draft linked to its source version and finds it by id', async () => {
    await program('p1');
    await seedVersion('v1', 'p1', 1, 'APPROVED');

    await repository.save(draft('v2', 'p1', 2, 'v1'));

    const found = await repository.findById('v2');
    expect(found?.status).toBe('DRAFT');
    expect(found?.number).toBe(2);
    expect(found?.basedOnVersionId).toBe('v1');
    expect(found?.createdBy).toBe('user-1');
    expect(await repository.findById('missing')).toBeNull();
  }, 15_000);

  it('inserts an initial version without a source (incomplete but valid)', async () => {
    await program('p1');

    await repository.save(draft('v1', 'p1', 1));

    const found = await repository.findById('v1');
    expect(found?.basedOnVersionId).toBeNull();
    expect(found?.isOpen()).toBe(true);
  }, 15_000);

  it('finds the current version and the open one, each only for its own program', async () => {
    await program('p1');
    await program('p2');
    await seedVersion('v1', 'p1', 1, 'APPROVED');
    await seedVersion('v2', 'p1', 2, 'IN_VALIDATION');
    await seedVersion('o1', 'p2', 1, 'HISTORICAL');

    expect((await repository.findCurrent('p1'))?.id).toBe('v1');
    expect((await repository.findOpen('p1'))?.id).toBe('v2');
    expect(await repository.findCurrent('p2')).toBeNull();
    expect(await repository.findOpen('p2')).toBeNull();
  }, 15_000);

  it('returns the highest number used, or 0 when the program has no versions', async () => {
    await program('p1');
    await program('p2');
    await seedVersion('v1', 'p1', 1, 'HISTORICAL');
    await seedVersion('v3', 'p1', 3, 'APPROVED');

    expect(await repository.maxNumber('p1')).toBe(3);
    expect(await repository.maxNumber('p2')).toBe(0);
  }, 15_000);

  it('lists the versions of a program from the newest to the oldest', async () => {
    await program('p1');
    await program('p2');
    await seedVersion('v1', 'p1', 1, 'HISTORICAL');
    await seedVersion('v3', 'p1', 3, 'DRAFT');
    await seedVersion('v2', 'p1', 2, 'APPROVED');
    await seedVersion('x1', 'p2', 1, 'APPROVED');

    const versions = await repository.list('p1');

    expect(versions.map((version) => version.number)).toEqual([3, 2, 1]);
    expect(await repository.list('none')).toEqual([]);
  }, 15_000);

  it('rejects a second open version for the same program', async () => {
    await program('p1');
    await seedVersion('v1', 'p1', 1, 'APPROVED');
    await repository.save(draft('v2', 'p1', 2, 'v1'));

    await expect(repository.save(draft('v3', 'p1', 3, 'v1'))).rejects.toBeInstanceOf(
      OpenCatalogVersionExistsError,
    );
    expect(await prisma.catalogVersion.count({ where: { programId: 'p1' } })).toBe(2);
  }, 15_000);

  it('rejects a draft while another version is in validation', async () => {
    await program('p1');
    await seedVersion('v1', 'p1', 1, 'IN_VALIDATION');

    await expect(repository.save(draft('v2', 'p1', 2))).rejects.toBeInstanceOf(
      OpenCatalogVersionExistsError,
    );
  }, 15_000);

  it('allows an open version in each program', async () => {
    await program('p1');
    await program('p2');

    await repository.save(draft('a1', 'p1', 1));
    await repository.save(draft('b1', 'p2', 1));

    expect(await prisma.catalogVersion.count()).toBe(2);
  }, 15_000);

  it('rejects a repeated (programId, number) pair with a numbering conflict', async () => {
    await program('p1');
    await seedVersion('v1', 'p1', 1, 'APPROVED');

    await expect(repository.save(draft('v1b', 'p1', 1))).rejects.toBeInstanceOf(
      CatalogVersionNumberConflictError,
    );
  }, 15_000);

  it('rejects a number below 1 at the database level', async () => {
    await program('p1');

    await expect(seedVersion('v0', 'p1', 0, 'DRAFT')).rejects.toThrow();
    await expect(seedVersion('vn', 'p1', -1, 'DRAFT')).rejects.toThrow();
  }, 15_000);

  it('rejects a second approved version for the same program', async () => {
    await program('p1');
    await seedVersion('v1', 'p1', 1, 'APPROVED');

    await expect(seedVersion('v2', 'p1', 2, 'APPROVED')).rejects.toThrow();
    // Una aprobada y una abierta conviven.
    await expect(seedVersion('v3', 'p1', 3, 'DRAFT')).resolves.toBeDefined();
  }, 15_000);

  it('declares both partial unique indexes in the database', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'catalog_versions'
    `;
    const byName = new Map(rows.map((row) => [row.indexname, row.indexdef]));

    expect(byName.get('catalog_versions_one_open_per_program')).toMatch(/UNIQUE.*WHERE/s);
    expect(byName.get('catalog_versions_one_approved_per_program')).toMatch(/UNIQUE.*WHERE/s);
  }, 15_000);

  it('refuses to delete a version that other versions are based on', async () => {
    await program('p1');
    await seedVersion('v1', 'p1', 1, 'HISTORICAL');
    await repository.save(draft('v2', 'p1', 2, 'v1'));

    await expect(prisma.catalogVersion.delete({ where: { id: 'v1' } })).rejects.toThrow();
  }, 15_000);

  it('refuses lockProgram outside a transaction', async () => {
    await program('p1');

    await expect(repository.lockProgram('p1')).rejects.toThrow(/transacción activa/);
  }, 15_000);

  it('locks the program row inside a transaction', async () => {
    await program('p1');

    await expect(uow.run(() => repository.lockProgram('p1'))).resolves.toBeUndefined();
  }, 15_000);

  it('lets exactly one of five concurrent open-version inserts win', async () => {
    await program('p1');

    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((number) =>
        uow.run(() => repository.save(draft(`v${number}`, 'p1', number))),
      ),
    );

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(OpenCatalogVersionExistsError);
    }
    expect(await prisma.catalogVersion.count({ where: { programId: 'p1' } })).toBe(1);
  }, 15_000);

  it('serializes number assignment under lockProgram so five callers get five consecutive numbers', async () => {
    await program('p1');
    // Sin versiones abiertas: se crean y se cierran en la misma prueba para observar la numeración.
    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map(() =>
        uow.run(async () => {
          await repository.lockProgram('p1');
          const next = (await repository.maxNumber('p1')) + 1;
          await prisma.catalogVersion.create({
            data: {
              id: `n${next}`,
              programId: 'p1',
              number: next,
              status: 'HISTORICAL',
            },
          });
          return next;
        }),
      ),
    );

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    const numbers = results
      .map((result) => (result as PromiseFulfilledResult<number>).value)
      .sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  }, 15_000);
});

describe('PrismaCatalogProgramReader Integration (PostgreSQL real, T-013-19)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const reader = new PrismaCatalogProgramReader(new PrismaUnitOfWork(prisma));

  it('returns null when there is no program', async () => {
    expect(await reader.getCurrentProgramId()).toBeNull();
  }, 15_000);

  it('returns the oldest program', async () => {
    await prisma.program.create({
      data: {
        id: 'old',
        code: 'OLD',
        name: 'Antiguo',
        faculty: 'FISME',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    await prisma.program.create({
      data: {
        id: 'new',
        code: 'NEW',
        name: 'Nuevo',
        faculty: 'FISME',
        createdAt: new Date('2026-06-01T00:00:00Z'),
      },
    });

    expect(await reader.getCurrentProgramId()).toBe('old');
  }, 15_000);
});
