import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { EducationalObjective } from '../../domain/entities/educational-objective.js';
import { PrismaEducationalObjectiveRepository } from './prisma-educational-objective-repository.js';

describe('PrismaEducationalObjectiveRepository Integration (PostgreSQL real, T-013-20)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaEducationalObjectiveRepository(uow);

  async function version(id = 'v1') {
    await prisma.program.upsert({
      where: { id: 'p1' },
      update: {},
      create: { id: 'p1', code: 'EPIS-P1', name: 'Programa', faculty: 'FISME' },
    });
    return prisma.catalogVersion.create({
      data: { id, programId: 'p1', number: id === 'v1' ? 1 : 2, status: 'DRAFT' },
    });
  }

  function objective(
    id: string,
    code: string,
    order: number,
    versionId = 'v1',
    statement = 'Texto.',
  ) {
    return EducationalObjective.create({
      id,
      versionId,
      code,
      statement,
      order,
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it('inserts copies under a new version and lists them ordered by position', async () => {
    await version();

    await uow.run(() =>
      repository.insertMany('v1', [
        objective('o3', 'OEP3', 3),
        objective('o1', 'OEP1', 1),
        objective('o2', 'OEP2', 2),
      ]),
    );

    const listed = await repository.listByVersion('v1');
    expect(listed.map((item) => item.code)).toEqual(['OEP1', 'OEP2', 'OEP3']);
    expect(listed[0]?.createdBy).toBe('user-1');
  }, 15_000);

  it('copies an objective into another version keeping code, text and order', async () => {
    await version('v1');
    await prisma.catalogVersion.update({ where: { id: 'v1' }, data: { status: 'APPROVED' } });
    await version('v2');
    await uow.run(() =>
      repository.insertMany('v1', [objective('o1', 'OEP1', 1, 'v1', 'Texto oficial del OE.')]),
    );

    const source = await repository.listByVersion('v1');
    await uow.run(() =>
      repository.insertMany(
        'v2',
        source.map((item) => item.copyTo(`${item.id}-copy`, 'v2', 'user-2')),
      ),
    );

    const copied = await repository.listByVersion('v2');
    expect(copied).toHaveLength(1);
    expect(copied[0]?.id).toBe('o1-copy');
    expect(copied[0]?.code).toBe('OEP1');
    expect(copied[0]?.statement).toBe('Texto oficial del OE.');
    expect(copied[0]?.order).toBe(1);
    expect(await repository.listByVersion('v1')).toHaveLength(1);
  }, 15_000);

  it('returns an empty list for a version without objectives (empty draft)', async () => {
    await version();

    expect(await repository.listByVersion('v1')).toEqual([]);
    expect(await repository.listByVersion('missing')).toEqual([]);
  }, 15_000);

  it('accepts an empty batch inside a transaction', async () => {
    await version();

    await expect(uow.run(() => repository.insertMany('v1', []))).resolves.toBeUndefined();
  }, 15_000);

  it('refuses insertMany outside a transaction', async () => {
    await version();

    await expect(repository.insertMany('v1', [objective('o1', 'OEP1', 1)])).rejects.toThrow(
      /transacción activa/,
    );
    expect(await prisma.educationalObjective.count()).toBe(0);
  }, 15_000);

  it('stores nothing when one row of the batch fails', async () => {
    await version();

    await expect(
      uow.run(() =>
        repository.insertMany('v1', [objective('o1', 'OEP1', 1), objective('o2', 'OEP1', 2)]),
      ),
    ).rejects.toThrow();
    expect(await prisma.educationalObjective.count()).toBe(0);
  }, 15_000);

  it('rejects a repeated code in the same version but accepts it in another', async () => {
    await version('v1');
    await prisma.catalogVersion.update({ where: { id: 'v1' }, data: { status: 'APPROVED' } });
    await version('v2');
    await uow.run(() => repository.insertMany('v1', [objective('o1', 'OEP1', 1)]));

    await expect(
      uow.run(() => repository.insertMany('v1', [objective('o2', 'OEP1', 2)])),
    ).rejects.toThrow();
    await expect(
      uow.run(() => repository.insertMany('v2', [objective('o3', 'OEP1', 1, 'v2')])),
    ).resolves.toBeUndefined();
  }, 15_000);

  it('rejects a repeated order in the same version', async () => {
    await version();
    await uow.run(() => repository.insertMany('v1', [objective('o1', 'OEP1', 1)]));

    await expect(
      uow.run(() => repository.insertMany('v1', [objective('o2', 'OEP2', 1)])),
    ).rejects.toThrow();
  }, 15_000);

  it('enforces the CHECK constraints for hostile values the domain would reject', async () => {
    await version();
    const base = {
      versionId: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const insert = (id: string, code: string, statement: string, order: number) =>
      prisma.educationalObjective.create({ data: { id, code, statement, order, ...base } });

    await expect(insert('c1', '', 'Texto', 1)).rejects.toThrow();
    await expect(insert('c2', 'oep1', 'Texto', 2)).rejects.toThrow();
    await expect(insert('c3', 'X'.repeat(5000), 'Texto', 3)).rejects.toThrow();
    await expect(insert('c4', 'OEP4', '   ', 4)).rejects.toThrow();
    await expect(insert('c5', 'OEP5', 'Texto', 0)).rejects.toThrow();
    // La columna admite texto largo: el límite de 2 000 es del dominio.
    await expect(insert('c6', 'OEP6', 'x'.repeat(100_000), 6)).resolves.toBeDefined();
  }, 15_000);

  it('refuses to delete a version that has objectives', async () => {
    await version();
    await uow.run(() => repository.insertMany('v1', [objective('o1', 'OEP1', 1)]));

    await expect(prisma.catalogVersion.delete({ where: { id: 'v1' } })).rejects.toThrow();
  }, 15_000);
});
