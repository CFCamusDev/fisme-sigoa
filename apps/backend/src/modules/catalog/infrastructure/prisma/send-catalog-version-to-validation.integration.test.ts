import { describe, expect, it } from 'vitest';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import {
  createCatalogFixture,
  createDraftCatalogVersion,
} from '../../../../test/factories/catalog.js';
import { SendCatalogVersionToValidationUseCase } from '../../application/send-catalog-version-to-validation.js';
import { InvalidCatalogTransitionError } from '../../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../../domain/ports/catalog-permission-checker.js';
import { PrismaCatalogVersionRepository } from './prisma-catalog-version-repository.js';
import { PrismaEducationalObjectiveRepository } from './prisma-educational-objective-repository.js';
import { PrismaGraduateAttributeRepository } from './prisma-graduate-attribute-repository.js';

describe('SendCatalogVersionToValidationUseCase Integration (PostgreSQL real, T-015-07, RF-015)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const versionRepository = new PrismaCatalogVersionRepository(uow);
  const allowAll: CatalogPermissionChecker = { assertAllowed: async () => undefined };

  const useCase = new SendCatalogVersionToValidationUseCase({
    versionRepository,
    objectiveReader: new PrismaEducationalObjectiveRepository(uow),
    attributeReader: new PrismaGraduateAttributeRepository(uow),
    permissionChecker: allowAll,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
  });

  async function draftVersion(options: Parameters<typeof createDraftCatalogVersion>[2] = {}) {
    const fixture = await createCatalogFixture(prisma);
    return await createDraftCatalogVersion(prisma, fixture, options);
  }

  it('transitions the status only when it still matches and reports whether a row changed', async () => {
    const id = await draftVersion();
    const now = new Date('2026-11-12T12:00:00.000Z');

    const first = await uow.run(() =>
      versionRepository.transitionStatus(id, 'DRAFT', 'IN_VALIDATION', 'user-1', now),
    );
    const second = await uow.run(() =>
      versionRepository.transitionStatus(id, 'DRAFT', 'IN_VALIDATION', 'user-2', now),
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
    const row = await prisma.catalogVersion.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('IN_VALIDATION');
    expect(row.updatedBy).toBe('user-1');
    expect(row.updatedAt).toEqual(now);
  }, 15_000);

  it('refuses transitionStatus outside a transaction', async () => {
    const id = await draftVersion();

    await expect(
      versionRepository.transitionStatus(id, 'DRAFT', 'IN_VALIDATION', 'user-1', new Date()),
    ).rejects.toThrow(/transacción activa/);
  }, 15_000);

  it('sends a complete draft to validation, exposes it as open and audits once', async () => {
    const id = await draftVersion();

    const result = await useCase.execute({ actorId: 'user-1', versionId: id });

    expect(result.status).toBe('IN_VALIDATION');
    expect(result.objectiveCount).toBe(4);
    expect(result.attributeCount).toBe(12);
    const row = await prisma.catalogVersion.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('IN_VALIDATION');
    expect((await versionRepository.findOpen(row.programId))?.status).toBe('IN_VALIDATION');
    const audits = await prisma.auditLog.findMany({ where: { entity: 'CatalogVersion' } });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe('STATE_CHANGE');
    expect(audits[0]?.entityId).toBe(id);
  }, 15_000);

  it('leaves the draft and the audit untouched when the attributes are missing', async () => {
    const id = await draftVersion({ attributeCount: 0 });

    await expect(useCase.execute({ actorId: 'user-1', versionId: id })).rejects.toBeInstanceOf(
      InvalidCatalogTransitionError,
    );

    const row = await prisma.catalogVersion.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('DRAFT');
    expect(await prisma.auditLog.count({ where: { entity: 'CatalogVersion' } })).toBe(0);
  }, 15_000);

  it('lets exactly one of N simultaneous sends win and audits once', async () => {
    const id = await draftVersion();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        useCase.execute({ actorId: `user-${index + 1}`, versionId: id }),
      ),
    );

    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(InvalidCatalogTransitionError);
    }
    const row = await prisma.catalogVersion.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('IN_VALIDATION');
    expect(await prisma.auditLog.count({ where: { entity: 'CatalogVersion' } })).toBe(1);
  }, 30_000);
});
