import { describe, expect, it } from 'vitest';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createInValidationCatalogVersion } from '../../../../test/factories/resolutions.js';
import { ActivateCatalogVersionUseCase } from '../../application/activate-catalog-version.js';
import type { CatalogPermissionChecker } from '../../domain/ports/catalog-permission-checker.js';
import { PrismaCatalogVersionRepository } from './prisma-catalog-version-repository.js';
import { PrismaEducationalObjectiveRepository } from './prisma-educational-objective-repository.js';
import { PrismaGraduateAttributeRepository } from './prisma-graduate-attribute-repository.js';

describe('ActivateCatalogVersionUseCase Integration (PostgreSQL real, T-016-03, RF-016)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const versionRepository = new PrismaCatalogVersionRepository(uow);
  const allowAll: CatalogPermissionChecker = { assertAllowed: async () => undefined };

  const useCase = new ActivateCatalogVersionUseCase({
    versionReader: versionRepository,
    versionRepository,
    objectiveReader: new PrismaEducationalObjectiveRepository(uow),
    attributeReader: new PrismaGraduateAttributeRepository(uow),
    permissionChecker: allowAll,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
  });

  it('keeps exactly one current version under concurrent approvals', async () => {
    // Solo puede haber una versión abierta por programa: las N aprobaciones compiten por la misma
    // versión (resoluciones de OE y AG, reintentos) y la vigente anterior pasa a Histórica.
    const versionId = await createInValidationCatalogVersion(prisma);
    const version = await prisma.catalogVersion.findUniqueOrThrow({ where: { id: versionId } });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        useCase.execute({ actorId: 'user-1', versionId, resolutionId: `resolution-${index}` }),
      ),
    );

    expect(results.map((result) => result.status)).toEqual(Array(5).fill('fulfilled'));
    const rows = await prisma.catalogVersion.findMany({
      where: { programId: version.programId },
      orderBy: { number: 'asc' },
    });
    expect(rows.map((row) => row.status)).toEqual(['HISTORICAL', 'APPROVED']);
    const audits = await prisma.auditLog.findMany({ where: { entity: 'CatalogVersion' } });
    expect(audits).toHaveLength(2);
  }, 30_000);
});
