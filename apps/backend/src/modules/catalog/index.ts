import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { CreateCatalogVersionUseCase } from './application/create-catalog-version.js';
import { GetCatalogVersionDetailUseCase } from './application/get-catalog-version-detail.js';
import { ListCatalogVersionsUseCase } from './application/list-catalog-versions.js';
import { ReorderCatalogItemsUseCase } from './application/reorder-catalog-items.js';
import { SaveEducationalObjectiveUseCase } from './application/save-educational-objective.js';
import { SaveGraduateAttributeUseCase } from './application/save-graduate-attribute.js';
import { ActivateCatalogVersionUseCase } from './application/activate-catalog-version.js';
import { SendCatalogVersionToValidationUseCase } from './application/send-catalog-version-to-validation.js';
import type { CatalogPermissionChecker } from './domain/ports/catalog-permission-checker.js';
import { createCatalogResolutionApprovedSubscriber } from './infrastructure/events/catalog-resolution-approved-subscriber.js';
import { CatalogVersionItemsController } from './infrastructure/http/catalog-version-items.controller.js';
import { CatalogVersionsController } from './infrastructure/http/catalog-versions.controller.js';
import {
  createCatalogVersionsRouter,
  type CatalogRoutePermissionScope,
} from './infrastructure/http/catalog-versions.routes.js';
import { PrismaCatalogProgramReader } from './infrastructure/prisma/prisma-catalog-program-reader.js';
import { PrismaCatalogVersionHistoryReader } from './infrastructure/prisma/prisma-catalog-version-history-reader.js';
import { PrismaCatalogVersionRepository } from './infrastructure/prisma/prisma-catalog-version-repository.js';
import { PrismaEducationalObjectiveRepository } from './infrastructure/prisma/prisma-educational-objective-repository.js';
import { PrismaGraduateAttributeRepository } from './infrastructure/prisma/prisma-graduate-attribute-repository.js';

export interface CatalogModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: CatalogRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: CatalogPermissionChecker;
  readonly clock?: () => Date;
}

export function createCatalogVersionsModule(deps?: CatalogModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const versionRepository = new PrismaCatalogVersionRepository(deps.dbProvider);
  const objectiveRepository = new PrismaEducationalObjectiveRepository(deps.dbProvider);
  const attributeRepository = new PrismaGraduateAttributeRepository(deps.dbProvider);
  const programReader = new PrismaCatalogProgramReader(deps.dbProvider);

  const createCatalogVersionUseCase = new CreateCatalogVersionUseCase({
    programReader,
    versionReader: versionRepository,
    versionRepository,
    objectiveReader: objectiveRepository,
    objectiveRepository,
    attributeReader: attributeRepository,
    attributeRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const listCatalogVersionsUseCase = new ListCatalogVersionsUseCase({
    programReader,
    versionReader: versionRepository,
    objectiveReader: objectiveRepository,
    attributeReader: attributeRepository,
    permissionChecker: deps.permissionChecker,
  });

  const controller = new CatalogVersionsController({
    createCatalogVersionUseCase,
    listCatalogVersionsUseCase,
  });

  const saveEducationalObjectiveUseCase = new SaveEducationalObjectiveUseCase({
    versionRepository,
    objectiveReader: objectiveRepository,
    objectiveRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const saveGraduateAttributeUseCase = new SaveGraduateAttributeUseCase({
    versionRepository,
    attributeReader: attributeRepository,
    attributeRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const reorderCatalogItemsUseCase = new ReorderCatalogItemsUseCase({
    versionRepository,
    objectiveReader: objectiveRepository,
    objectiveRepository,
    attributeReader: attributeRepository,
    attributeRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const historyReader = new PrismaCatalogVersionHistoryReader(deps.dbProvider);

  const getCatalogVersionDetailUseCase = new GetCatalogVersionDetailUseCase({
    versionReader: versionRepository,
    objectiveReader: objectiveRepository,
    attributeReader: attributeRepository,
    historyReader,
    permissionChecker: deps.permissionChecker,
  });

  const sendCatalogVersionToValidationUseCase = new SendCatalogVersionToValidationUseCase({
    versionRepository,
    objectiveReader: objectiveRepository,
    attributeReader: attributeRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const itemsController = new CatalogVersionItemsController({
    sendCatalogVersionToValidationUseCase,
    saveEducationalObjectiveUseCase,
    saveGraduateAttributeUseCase,
    reorderCatalogItemsUseCase,
    getCatalogVersionDetailUseCase,
  });

  return createCatalogVersionsRouter({
    controller,
    itemsController,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/catalog-limits.js';
export * from './domain/entities/catalog-version.js';
export * from './domain/entities/educational-objective.js';
export * from './domain/entities/graduate-attribute.js';
export * from './domain/policies/catalog-version-state-machine.js';
export * from './domain/policies/catalog-activation-policy.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './infrastructure/prisma/prisma-catalog-version-mapper.js';
export * from './infrastructure/prisma/prisma-catalog-version-repository.js';
export * from './infrastructure/prisma/prisma-catalog-program-reader.js';
export * from './infrastructure/prisma/prisma-catalog-version-history-reader.js';
export * from './infrastructure/prisma/prisma-educational-objective-mapper.js';
export * from './infrastructure/prisma/prisma-educational-objective-repository.js';
export * from './infrastructure/prisma/prisma-graduate-attribute-mapper.js';
export * from './infrastructure/prisma/prisma-graduate-attribute-repository.js';
export * from './application/catalog-version-dto.js';
export * from './application/create-catalog-version.js';
export * from './application/create-catalog-version.types.js';
export * from './application/list-catalog-versions.js';
export * from './application/list-catalog-versions.types.js';
export * from './application/catalog-item-dto.js';
export * from './application/get-catalog-version-detail.js';
export * from './application/save-educational-objective.js';
export * from './application/save-educational-objective.types.js';
export * from './application/save-graduate-attribute.js';
export * from './application/save-graduate-attribute.types.js';
export * from './application/reorder-catalog-items.js';
export * from './application/reorder-catalog-items.types.js';
export * from './application/activate-catalog-version.js';
export * from './application/activate-catalog-version.types.js';
export * from './application/send-catalog-version-to-validation.js';
export * from './application/send-catalog-version-to-validation.types.js';
export * from './application/compare-catalog-versions.js';
export * from './application/catalog-version-history-dto.js';
export * from './domain/policies/word-diff.js';
export * from './domain/policies/catalog-comparison.js';
export * from './domain/policies/catalog-version-validity.js';
export * from './infrastructure/prisma/seed/catalog-seed-data.js';
export * from './infrastructure/prisma/seed/catalog-version-seed.js';
export * from './infrastructure/http/catalog-versions.controller.js';
export * from './infrastructure/http/catalog-version-items.controller.js';
export * from './infrastructure/http/catalog-versions.routes.js';
export * from './infrastructure/events/catalog-resolution-approved-subscriber.js';

export type CatalogActivationSubscriberDependencies = Omit<
  CatalogModuleDependencies,
  'authenticate' | 'requirePermission'
>;

/** Suscriptor de `ResolutionApproved` que activa la versión del catálogo (HU-016, D2). */
export function createCatalogActivationSubscriber(deps: CatalogActivationSubscriberDependencies) {
  const versionRepository = new PrismaCatalogVersionRepository(deps.dbProvider);
  const objectiveRepository = new PrismaEducationalObjectiveRepository(deps.dbProvider);
  const attributeRepository = new PrismaGraduateAttributeRepository(deps.dbProvider);

  return createCatalogResolutionApprovedSubscriber(
    new ActivateCatalogVersionUseCase({
      versionReader: versionRepository,
      versionRepository,
      objectiveReader: objectiveRepository,
      attributeReader: attributeRepository,
      permissionChecker: deps.permissionChecker,
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      clock: deps.clock,
    }),
  );
}
