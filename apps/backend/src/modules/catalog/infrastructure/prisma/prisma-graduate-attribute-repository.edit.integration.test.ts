import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { GraduateAttribute } from '../../domain/entities/graduate-attribute.js';
import { CatalogItemNotFoundError, DuplicateCatalogCodeError } from '../../domain/errors/index.js';
import { PrismaGraduateAttributeRepository } from './prisma-graduate-attribute-repository.js';

const now = new Date('2026-11-12T10:00:00.000Z');

describe('PrismaGraduateAttributeRepository edit operations (PostgreSQL real, T-014-03)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaGraduateAttributeRepository(uow);

  async function seed() {
    await prisma.program.create({
      data: { id: 'p1', code: 'EPIS-P1', name: 'Programa', faculty: 'FISME' },
    });
    for (const [id, number] of [
      ['v1', 1],
      ['v2', 2],
    ] as const) {
      await prisma.catalogVersion.create({
        data: { id, programId: 'p1', number, status: number === 1 ? 'APPROVED' : 'DRAFT' },
      });
    }
    await prisma.graduateAttribute.createMany({
      data: [
        { id: 'a1', versionId: 'v2', code: 'AG-C01', name: 'Uno', statement: 'Uno.', order: 1 },
        { id: 'a2', versionId: 'v2', code: 'AG-C02', name: 'Dos', statement: 'Dos.', order: 2 },
        { id: 'x1', versionId: 'v1', code: 'AG-C01', name: 'Otra', statement: 'Otra.', order: 1 },
      ],
    });
  }

  function attribute(id: string, code: string, order: number) {
    return GraduateAttribute.createNew({
      id,
      versionId: 'v2',
      code,
      name: 'Nombre',
      statement: 'Texto.',
      order,
      actorId: 'user-1',
      now,
    });
  }

  it('finds an attribute by id and returns null when it does not exist', async () => {
    await seed();

    expect((await repository.findById('a1'))?.name).toBe('Uno');
    expect(await repository.findById('missing')).toBeNull();
  }, 15_000);

  it('inserts a new attribute', async () => {
    await seed();

    await repository.insert(attribute('a3', 'AG-C03', 3));

    const listed = await repository.listByVersion('v2');
    expect(listed.map((item) => item.code)).toEqual(['AG-C01', 'AG-C02', 'AG-C03']);
  }, 15_000);

  it('rejects an insert with a code already used in the version', async () => {
    await seed();

    await expect(repository.insert(attribute('a3', 'AG-C02', 3))).rejects.toBeInstanceOf(
      DuplicateCatalogCodeError,
    );
  }, 15_000);

  it('updates code, name and statement without touching the order or other versions', async () => {
    await seed();
    const edited = (await repository.findById('a1'))!.edit({
      code: 'AG-C09',
      name: 'Nuevo nombre',
      statement: 'Nuevo texto.',
      actorId: 'user-2',
      now,
    });

    await repository.update(edited);

    const row = await prisma.graduateAttribute.findUniqueOrThrow({ where: { id: 'a1' } });
    expect(row).toMatchObject({
      code: 'AG-C09',
      name: 'Nuevo nombre',
      statement: 'Nuevo texto.',
      order: 1,
      updatedBy: 'user-2',
    });
    expect((await prisma.graduateAttribute.findUniqueOrThrow({ where: { id: 'x1' } })).code).toBe(
      'AG-C01',
    );
  }, 15_000);

  it('does not update an attribute that belongs to another version', async () => {
    await seed();
    const foreign = (await repository.findById('x1'))!;
    const wrongVersion = GraduateAttribute.create({
      id: foreign.id,
      versionId: 'v2',
      code: 'AG-C07',
      name: foreign.name,
      statement: foreign.statement,
      order: foreign.order,
      createdAt: now,
      updatedAt: now,
    });

    await expect(repository.update(wrongVersion)).rejects.toBeInstanceOf(CatalogItemNotFoundError);
    expect((await prisma.graduateAttribute.findUniqueOrThrow({ where: { id: 'x1' } })).code).toBe(
      'AG-C01',
    );
  }, 15_000);

  it('rejects an update with a code used by another attribute of the version', async () => {
    await seed();
    const edited = (await repository.findById('a1'))!.edit({
      code: 'AG-C02',
      name: 'Uno',
      statement: 'Uno.',
      actorId: 'user-2',
      now,
    });

    await expect(repository.update(edited)).rejects.toBeInstanceOf(DuplicateCatalogCodeError);
  }, 15_000);
});
