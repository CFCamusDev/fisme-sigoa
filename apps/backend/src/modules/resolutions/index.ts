import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import {
  ApproveResolutionUseCase,
  type ApproveResolutionLogger,
} from './application/approve-resolution.js';
import { ListResolutionsUseCase } from './application/list-resolutions.js';
import { RegisterResolutionUseCase } from './application/register-resolution.js';
import type { ResolutionApprovedSubscriber } from './domain/ports/resolution-event-publisher.js';
import type { ResolutionPermissionChecker } from './domain/ports/resolution-permission-checker.js';
import type { FileStorage } from '../../shared/storage/file-storage.js';
import { InProcessResolutionEventPublisher } from './infrastructure/events/in-process-resolution-event-publisher.js';
import { FileStorageResolutionPdfStorage } from './infrastructure/storage/file-storage-resolution-pdf-storage.js';
import { ResolutionsController } from './infrastructure/http/resolutions.controller.js';
import {
  createResolutionsRouter,
  type ResolutionRoutePermissionScope,
} from './infrastructure/http/resolutions.routes.js';
import { PrismaResolutionCatalogVersionReader } from './infrastructure/prisma/prisma-resolution-catalog-version-reader.js';
import { PrismaResolutionRepository } from './infrastructure/prisma/prisma-resolution-repository.js';

export interface ResolutionsModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ResolutionRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: ResolutionPermissionChecker;
  readonly fileStorage: FileStorage;
  /** Suscriptores de `ResolutionApproved`; HU-016 registra el suyo (D6). */
  readonly resolutionApprovedSubscribers?: readonly ResolutionApprovedSubscriber[];
  readonly logger?: ApproveResolutionLogger;
  readonly clock?: () => Date;
}

export function createResolutionsModule(deps?: ResolutionsModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const resolutionRepository = new PrismaResolutionRepository(deps.dbProvider);
  const versionReader = new PrismaResolutionCatalogVersionReader(deps.dbProvider);

  const registerResolutionUseCase = new RegisterResolutionUseCase({
    versionReader,
    resolutionRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const approveResolutionUseCase = new ApproveResolutionUseCase({
    resolutionRepository,
    pdfStorage: new FileStorageResolutionPdfStorage(deps.fileStorage),
    eventPublisher: new InProcessResolutionEventPublisher(deps.resolutionApprovedSubscribers ?? []),
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    logger: deps.logger,
    clock: deps.clock,
  });

  const listResolutionsUseCase = new ListResolutionsUseCase({
    resolutionReader: resolutionRepository,
    permissionChecker: deps.permissionChecker,
  });

  const controller = new ResolutionsController({
    registerResolutionUseCase,
    approveResolutionUseCase,
    listResolutionsUseCase,
  });

  return createResolutionsRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/resolution-enums.js';
export * from './domain/entities/resolution.js';
export * from './domain/entities/resolution-approved.js';
export * from './domain/policies/resolution-state-machine.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './infrastructure/prisma/prisma-resolution-mapper.js';
export * from './infrastructure/prisma/prisma-resolution-repository.js';
export * from './infrastructure/prisma/prisma-resolution-catalog-version-reader.js';
export * from './application/resolution-dto.js';
export * from './application/register-resolution.js';
export * from './application/register-resolution.types.js';
export * from './application/approve-resolution.js';
export * from './application/approve-resolution.types.js';
export * from './application/list-resolutions.js';
export * from './application/list-resolutions.types.js';
export * from './application/resolution-pdf-rules.js';
export * from './infrastructure/storage/file-storage-resolution-pdf-storage.js';
export * from './infrastructure/events/in-process-resolution-event-publisher.js';
export * from './infrastructure/http/resolutions.controller.js';
export * from './infrastructure/http/resolutions.routes.js';
