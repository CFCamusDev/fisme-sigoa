import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { CatalogOrderMismatchError } from '../../domain/errors/index.js';
import { PrismaEducationalObjectiveRepository } from './prisma-educational-objective-repository.js';
import { PrismaGraduateAttributeRepository } from './prisma-graduate-attribute-repository.js';

const now = new Date('2026-11-12T10:00:00.000Z');

describe('updateOrders in two phases (PostgreSQL real, T-014-04)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const objectives = new PrismaEducationalObjectiveRepository(uow);
  const attributes = new PrismaGraduateAttributeRepository(uow);

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
        { id: 'o3', versionId: 'v2', code: 'OEP3', statement: 'Tres.', order: 3 },
        { id: 'x1', versionId: 'v1', code: 'OEP1', statement: 'Otra.', order: 1 },
      ],
    });
    await prisma.graduateAttribute.createMany({
      data: [
        { id: 'a1', versionId: 'v2', code: 'AG-C01', name: 'Uno', statement: 'Uno.', order: 1 },
        { id: 'a2', versionId: 'v2', code: 'AG-C02', name: 'Dos', statement: 'Dos.', order: 2 },
      ],
    });
  }

  it('swaps orders despite the unique (versionId, order) index and stamps the actor', async () => {
    await seed();

    await uow.run(() =>
      objectives.updateOrders(
        'v2',
        [
          { id: 'o1', order: 3 },
          { id: 'o3', order: 1 },
        ],
        'user-2',
        now,
      ),
    );

    const listed = await objectives.listByVersion('v2');
    expect(listed.map((item) => [item.code, item.order])).toEqual([
      ['OEP3', 1],
      ['OEP2', 2],
      ['OEP1', 3],
    ]);
    const untouched = await prisma.educationalObjective.findUniqueOrThrow({ where: { id: 'o2' } });
    expect(untouched.updatedBy).toBeNull();
    const moved = await prisma.educationalObjective.findUniqueOrThrow({ where: { id: 'o1' } });
    expect(moved.updatedBy).toBe('user-2');
  }, 15_000);

  it('reorders attributes the same way', async () => {
    await seed();

    await uow.run(() =>
      attributes.updateOrders(
        'v2',
        [
          { id: 'a1', order: 2 },
          { id: 'a2', order: 1 },
        ],
        'user-2',
        now,
      ),
    );

    expect((await attributes.listByVersion('v2')).map((item) => item.code)).toEqual([
      'AG-C02',
      'AG-C01',
    ]);
  }, 15_000);

  it('does nothing when there are no changes', async () => {
    await seed();

    await expect(
      uow.run(() => objectives.updateOrders('v2', [], 'user-2', now)),
    ).resolves.toBeUndefined();
  }, 15_000);

  it('rolls everything back when an id belongs to another version', async () => {
    await seed();

    await expect(
      uow.run(() =>
        objectives.updateOrders(
          'v2',
          [
            { id: 'o1', order: 2 },
            { id: 'x1', order: 1 },
          ],
          'user-2',
          now,
        ),
      ),
    ).rejects.toBeInstanceOf(CatalogOrderMismatchError);

    expect((await objectives.listByVersion('v2')).map((item) => item.order)).toEqual([1, 2, 3]);
    expect(
      (await prisma.educationalObjective.findUniqueOrThrow({ where: { id: 'x1' } })).order,
    ).toBe(1);
  }, 15_000);

  it('refuses updateOrders outside a transaction', async () => {
    await seed();

    await expect(
      objectives.updateOrders('v2', [{ id: 'o1', order: 2 }], 'user-2', now),
    ).rejects.toThrow(/transacción activa/);
  }, 15_000);
});
