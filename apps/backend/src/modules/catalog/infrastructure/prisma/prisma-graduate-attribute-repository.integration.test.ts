import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { GraduateAttribute } from '../../domain/entities/graduate-attribute.js';
import { PrismaGraduateAttributeRepository } from './prisma-graduate-attribute-repository.js';

describe('PrismaGraduateAttributeRepository Integration (PostgreSQL real, T-013-21)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaGraduateAttributeRepository(uow);

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

  function attribute(id: string, code: string, order: number, versionId = 'v1') {
    return GraduateAttribute.create({
      id,
      versionId,
      code,
      name: `Nombre ${code}`,
      statement: `Texto de ${code}.`,
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
        attribute('a3', 'AG-C03', 3),
        attribute('a1', 'AG-C01', 1),
        attribute('a2', 'AG-C02', 2),
      ]),
    );

    const listed = await repository.listByVersion('v1');
    expect(listed.map((item) => item.code)).toEqual(['AG-C01', 'AG-C02', 'AG-C03']);
    expect(listed[0]?.name).toBe('Nombre AG-C01');
  }, 15_000);

  it('copies an attribute into another version keeping code, name, text and order', async () => {
    await version('v1');
    await prisma.catalogVersion.update({ where: { id: 'v1' }, data: { status: 'APPROVED' } });
    await version('v2');
    await uow.run(() => repository.insertMany('v1', [attribute('a1', 'AG-C01', 1)]));

    const source = await repository.listByVersion('v1');
    await uow.run(() =>
      repository.insertMany(
        'v2',
        source.map((item) => item.copyTo(`${item.id}-copy`, 'v2', 'user-2')),
      ),
    );

    const copied = await repository.listByVersion('v2');
    expect(copied).toHaveLength(1);
    expect(copied[0]?.id).toBe('a1-copy');
    expect(copied[0]?.code).toBe('AG-C01');
    expect(copied[0]?.name).toBe('Nombre AG-C01');
    expect(copied[0]?.statement).toBe('Texto de AG-C01.');
    expect(copied[0]?.order).toBe(1);
    expect(await repository.listByVersion('v1')).toHaveLength(1);
  }, 15_000);

  it('returns an empty list for a version without attributes (empty draft)', async () => {
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

    await expect(repository.insertMany('v1', [attribute('a1', 'AG-C01', 1)])).rejects.toThrow(
      /transacción activa/,
    );
    expect(await prisma.graduateAttribute.count()).toBe(0);
  }, 15_000);

  it('stores nothing when one row of the batch fails', async () => {
    await version();

    await expect(
      uow.run(() =>
        repository.insertMany('v1', [attribute('a1', 'AG-C01', 1), attribute('a2', 'AG-C01', 2)]),
      ),
    ).rejects.toThrow();
    expect(await prisma.graduateAttribute.count()).toBe(0);
  }, 15_000);

  it('rejects a repeated code in the same version but accepts it in another', async () => {
    await version('v1');
    await prisma.catalogVersion.update({ where: { id: 'v1' }, data: { status: 'APPROVED' } });
    await version('v2');
    await uow.run(() => repository.insertMany('v1', [attribute('a1', 'AG-C01', 1)]));

    await expect(
      uow.run(() => repository.insertMany('v1', [attribute('a2', 'AG-C01', 2)])),
    ).rejects.toThrow();
    await expect(
      uow.run(() => repository.insertMany('v2', [attribute('a3', 'AG-C01', 1, 'v2')])),
    ).resolves.toBeUndefined();
  }, 15_000);

  it('rejects a repeated order in the same version', async () => {
    await version();
    await uow.run(() => repository.insertMany('v1', [attribute('a1', 'AG-C01', 1)]));

    await expect(
      uow.run(() => repository.insertMany('v1', [attribute('a2', 'AG-C02', 1)])),
    ).rejects.toThrow();
  }, 15_000);

  it('enforces the CHECK constraints for hostile values the domain would reject', async () => {
    await version();
    const base = { versionId: 'v1', createdAt: new Date(), updatedAt: new Date() };
    const insert = (id: string, code: string, name: string, statement: string, order: number) =>
      prisma.graduateAttribute.create({ data: { id, code, name, statement, order, ...base } });

    await expect(insert('c1', '', 'Nombre', 'Texto', 1)).rejects.toThrow();
    await expect(insert('c2', 'ag-c02', 'Nombre', 'Texto', 2)).rejects.toThrow();
    await expect(insert('c3', 'X'.repeat(5000), 'Nombre', 'Texto', 3)).rejects.toThrow();
    await expect(insert('c4', 'AG-C04', '  ', 'Texto', 4)).rejects.toThrow();
    await expect(insert('c5', 'AG-C05', 'Nombre', '   ', 5)).rejects.toThrow();
    await expect(insert('c6', 'AG-C06', 'Nombre', 'Texto', 0)).rejects.toThrow();
    // La columna admite texto largo: el límite de 2 000 es del dominio.
    await expect(insert('c7', 'AG-C07', 'Nombre', 'x'.repeat(100_000), 7)).resolves.toBeDefined();
  }, 15_000);

  it('counts attributes per version in one query, with zero for versions without rows', async () => {
    await version('v1');
    await prisma.catalogVersion.update({ where: { id: 'v1' }, data: { status: 'APPROVED' } });
    await version('v2');
    await uow.run(() =>
      repository.insertMany('v1', [
        attribute('a1', 'AG-C01', 1),
        attribute('a2', 'AG-C02', 2),
        attribute('a3', 'AG-C03', 3),
      ]),
    );

    const counts = await repository.countByVersionIds(['v1', 'v2', 'missing']);

    expect(Object.fromEntries(counts)).toEqual({ v1: 3, v2: 0, missing: 0 });
    expect((await repository.countByVersionIds([])).size).toBe(0);
  }, 15_000);

  it('refuses to delete a version that has attributes', async () => {
    await version();
    await uow.run(() => repository.insertMany('v1', [attribute('a1', 'AG-C01', 1)]));

    await expect(prisma.catalogVersion.delete({ where: { id: 'v1' } })).rejects.toThrow();
  }, 15_000);
});
