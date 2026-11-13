import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { EducationalObjective } from '../../domain/entities/educational-objective.js';
import { CatalogItemNotFoundError, DuplicateCatalogCodeError } from '../../domain/errors/index.js';
import { PrismaEducationalObjectiveRepository } from './prisma-educational-objective-repository.js';

const now = new Date('2026-11-12T10:00:00.000Z');

describe('PrismaEducationalObjectiveRepository edit operations (PostgreSQL real, T-014-02)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaEducationalObjectiveRepository(uow);

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
    await prisma.educationalObjective.createMany({
      data: [
        { id: 'o1', versionId: 'v2', code: 'OEP1', statement: 'Uno.', order: 1 },
        { id: 'o2', versionId: 'v2', code: 'OEP2', statement: 'Dos.', order: 2 },
        { id: 'x1', versionId: 'v1', code: 'OEP1', statement: 'Otra versión.', order: 1 },
      ],
    });
  }

  function objective(id: string, code: string, order: number, versionId = 'v2') {
    return EducationalObjective.createNew({
      id,
      versionId,
      code,
      statement: 'Texto.',
      order,
      actorId: 'user-1',
      now,
    });
  }

  it('finds an objective by id and returns null when it does not exist', async () => {
    await seed();

    expect((await repository.findById('o1'))?.code).toBe('OEP1');
    expect(await repository.findById('missing')).toBeNull();
  }, 15_000);

  it('inserts a new objective', async () => {
    await seed();

    await repository.insert(objective('o3', 'OEP3', 3));

    const listed = await repository.listByVersion('v2');
    expect(listed.map((item) => item.code)).toEqual(['OEP1', 'OEP2', 'OEP3']);
    expect(listed[2]?.createdBy).toBe('user-1');
  }, 15_000);

  it('rejects an insert with a code already used in the version', async () => {
    await seed();

    await expect(repository.insert(objective('o3', 'OEP2', 3))).rejects.toBeInstanceOf(
      DuplicateCatalogCodeError,
    );
    expect(await prisma.educationalObjective.count({ where: { versionId: 'v2' } })).toBe(2);
  }, 15_000);

  it('updates code and statement filtering by id and version', async () => {
    await seed();
    const edited = (await repository.findById('o1'))!.edit({
      code: 'OEP9',
      statement: 'Nuevo texto.',
      actorId: 'user-2',
      now,
    });

    await repository.update(edited);

    const row = await prisma.educationalObjective.findUniqueOrThrow({ where: { id: 'o1' } });
    expect(row).toMatchObject({
      code: 'OEP9',
      statement: 'Nuevo texto.',
      order: 1,
      updatedBy: 'user-2',
    });
    // El de la otra versión no se toca.
    expect(
      (await prisma.educationalObjective.findUniqueOrThrow({ where: { id: 'x1' } })).code,
    ).toBe('OEP1');
  }, 15_000);

  it('does not update an objective that belongs to another version', async () => {
    await seed();
    const foreign = (await repository.findById('x1'))!.edit({
      code: 'OEP7',
      statement: 'Texto.',
      actorId: 'user-2',
      now,
    });
    // Mismo id pero declarando otra versión: el filtro por versión no encuentra la fila.
    const wrongVersion = EducationalObjective.create({
      id: foreign.id,
      versionId: 'v2',
      code: foreign.code,
      statement: foreign.statement,
      order: foreign.order,
      createdAt: now,
      updatedAt: now,
    });

    await expect(repository.update(wrongVersion)).rejects.toBeInstanceOf(CatalogItemNotFoundError);
    expect(
      (await prisma.educationalObjective.findUniqueOrThrow({ where: { id: 'x1' } })).code,
    ).toBe('OEP1');
  }, 15_000);

  it('rejects an update with a code used by another objective of the version', async () => {
    await seed();
    const edited = (await repository.findById('o1'))!.edit({
      code: 'OEP2',
      statement: 'Texto.',
      actorId: 'user-2',
      now,
    });

    await expect(repository.update(edited)).rejects.toBeInstanceOf(DuplicateCatalogCodeError);
  }, 15_000);
});
