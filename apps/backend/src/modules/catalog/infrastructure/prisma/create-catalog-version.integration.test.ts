import { describe, expect, it } from 'vitest';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createCatalogFixture } from '../../../../test/factories/catalog.js';
import { CreateCatalogVersionUseCase } from '../../application/create-catalog-version.js';
import { OpenCatalogVersionExistsError } from '../../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../../domain/ports/catalog-permission-checker.js';
import { PrismaCatalogProgramReader } from './prisma-catalog-program-reader.js';
import { PrismaCatalogVersionRepository } from './prisma-catalog-version-repository.js';
import { PrismaEducationalObjectiveRepository } from './prisma-educational-objective-repository.js';
import { PrismaGraduateAttributeRepository } from './prisma-graduate-attribute-repository.js';

describe('CreateCatalogVersionUseCase Integration (PostgreSQL real, T-013-22, RF-013)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);

  const allowAll: CatalogPermissionChecker = { assertAllowed: async () => undefined };

  function buildUseCase(objectiveRepository = new PrismaEducationalObjectiveRepository(uow)) {
    const versionRepository = new PrismaCatalogVersionRepository(uow);
    const attributeRepository = new PrismaGraduateAttributeRepository(uow);
    return new CreateCatalogVersionUseCase({
      programReader: new PrismaCatalogProgramReader(uow),
      versionReader: versionRepository,
      versionRepository,
      objectiveReader: objectiveRepository,
      objectiveRepository,
      attributeReader: attributeRepository,
      attributeRepository,
      permissionChecker: allowAll,
      unitOfWork: uow,
      auditLogger: auditServices.auditLogger,
    });
  }

  it('lets exactly one of five concurrent requests create the draft', async () => {
    await createCatalogFixture(prisma);
    const useCase = buildUseCase();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => useCase.execute({ actorId: 'user-1' })),
    );

    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(OpenCatalogVersionExistsError);
    }
    expect(await prisma.catalogVersion.count()).toBe(2);
    expect(await prisma.auditLog.count({ where: { entity: 'CatalogVersion' } })).toBe(1);
    const draft = await prisma.catalogVersion.findFirstOrThrow({ where: { status: 'DRAFT' } });
    expect(draft.number).toBe(2);
    expect(await prisma.educationalObjective.count({ where: { versionId: draft.id } })).toBe(4);
    expect(await prisma.graduateAttribute.count({ where: { versionId: draft.id } })).toBe(12);
  }, 15_000);

  it('leaves no header, copy or audit when the copy fails (atomicity)', async () => {
    await createCatalogFixture(prisma);
    const failing = new PrismaEducationalObjectiveRepository(uow);
    failing.insertMany = async () => {
      throw new Error('fallo simulado de la copia');
    };

    await expect(buildUseCase(failing).execute({ actorId: 'user-1' })).rejects.toThrow(
      'fallo simulado de la copia',
    );

    expect(await prisma.catalogVersion.count()).toBe(1);
    expect(await prisma.educationalObjective.count()).toBe(4);
    expect(await prisma.graduateAttribute.count()).toBe(12);
    expect(await prisma.auditLog.count({ where: { entity: 'CatalogVersion' } })).toBe(0);
  }, 15_000);

  it('can create a new draft once the previous one is no longer open', async () => {
    await createCatalogFixture(prisma);
    const useCase = buildUseCase();
    const first = await useCase.execute({ actorId: 'user-1' });
    await prisma.catalogVersion.update({ where: { id: first.id }, data: { status: 'HISTORICAL' } });

    const second = await useCase.execute({ actorId: 'user-1' });

    expect(second.number).toBe(3);
    expect(second.basedOnVersionId).not.toBe(first.id);
  }, 15_000);
});
