import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { PdfGenerator } from '../../shared/pdf/pdf-generator.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { EditTemplateUseCase } from './application/edit-template.js';
import { GetTemplateDetailUseCase } from './application/get-template-detail.js';
import { ListTemplatesUseCase } from './application/list-templates.js';
import { PreviewTemplateUseCase } from './application/preview-template.js';
import { PublishTemplateUseCase } from './application/publish-template.js';
import type { TemplatePermissionChecker } from './domain/ports/template-permission-checker.js';
import { TemplatesController } from './infrastructure/http/templates.controller.js';
import {
  createTemplatesRouter,
  type TemplateRoutePermissionScope,
} from './infrastructure/http/templates.routes.js';
import { PrismaTemplateRepository } from './infrastructure/prisma/prisma-template-repository.js';
import { PrismaTemplateVersionRepository } from './infrastructure/prisma/prisma-template-version-repository.js';

export interface TemplatesModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: TemplateRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: TemplatePermissionChecker;
  readonly pdfGenerator: PdfGenerator;
  readonly clock?: () => Date;
}

export function createTemplatesModule(deps?: TemplatesModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const templateRepository = new PrismaTemplateRepository(deps.dbProvider);
  const versionRepository = new PrismaTemplateVersionRepository(deps.dbProvider);

  const listTemplatesUseCase = new ListTemplatesUseCase({
    templateReader: templateRepository,
    versionReader: versionRepository,
    permissionChecker: deps.permissionChecker,
  });

  const getTemplateDetailUseCase = new GetTemplateDetailUseCase({
    templateReader: templateRepository,
    versionReader: versionRepository,
    permissionChecker: deps.permissionChecker,
  });

  const writeDependencies = {
    templateRepository,
    versionReader: versionRepository,
    versionRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  };
  const editTemplateUseCase = new EditTemplateUseCase(writeDependencies);
  const publishTemplateUseCase = new PublishTemplateUseCase(writeDependencies);
  const previewTemplateUseCase = new PreviewTemplateUseCase({
    templateReader: templateRepository,
    permissionChecker: deps.permissionChecker,
    pdfGenerator: deps.pdfGenerator,
  });

  const controller = new TemplatesController({
    listTemplatesUseCase,
    getTemplateDetailUseCase,
    editTemplateUseCase,
    publishTemplateUseCase,
    previewTemplateUseCase,
  });

  return createTemplatesRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/template.js';
export * from './domain/entities/template-version.js';
export * from './domain/entities/template-limits.js';
export * from './domain/policies/template-version-state-machine.js';
export * from './domain/policies/template-content-policy.js';
export * from './domain/policies/unrecognized-variable-detector.js';
export * from './domain/policies/template-renderer.js';
export * from './domain/policies/template-sample-data.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/template-dto.js';
export * from './application/template-audit.js';
export * from './application/edit-template.js';
export * from './application/edit-template.types.js';
export * from './application/publish-template.js';
export * from './application/publish-template.types.js';
export * from './application/list-templates.js';
export * from './application/list-templates.types.js';
export * from './application/get-template-detail.js';
export * from './application/preview-template.js';
export * from './application/preview-template.types.js';
export * from './infrastructure/prisma/prisma-template-mapper.js';
export * from './infrastructure/prisma/prisma-template-repository.js';
export * from './infrastructure/prisma/prisma-template-version-mapper.js';
export * from './infrastructure/prisma/prisma-template-version-repository.js';
export * from './infrastructure/http/templates.controller.js';
export * from './infrastructure/http/templates.routes.js';
export * from './infrastructure/prisma/seed/template-seed.js';
export * from './infrastructure/prisma/seed/template-seed-data.js';
export * from './infrastructure/prisma/seed/template-seed-types.js';
