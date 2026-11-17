import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { AddStakeholderListMemberUseCase } from './application/add-stakeholder-list-member.js';
import { ConfirmStakeholderImportUseCase } from './application/confirm-stakeholder-import.js';
import { CopyStakeholderListToNewYearUseCase } from './application/copy-stakeholder-list-to-new-year.js';
import { CreateStakeholderListUseCase } from './application/create-stakeholder-list.js';
import { DownloadStakeholderImportTemplateUseCase } from './application/download-stakeholder-import-template.js';
import { EditStakeholderUseCase } from './application/edit-stakeholder.js';
import { ListStakeholderListsUseCase } from './application/list-stakeholder-lists.js';
import { PreviewStakeholderImportUseCase } from './application/preview-stakeholder-import.js';
import { RegisterStakeholderUseCase } from './application/register-stakeholder.js';
import { SearchStakeholdersUseCase } from './application/search-stakeholders.js';
import { VoidStakeholderUseCase } from './application/void-stakeholder.js';
import type { StakeholderPermissionChecker } from './domain/ports/stakeholder-permission-checker.js';
import { ExcelJsStakeholderImportFileReader } from './infrastructure/excel/exceljs-stakeholder-import-file-reader.js';
import { ExcelJsStakeholderImportTemplateBuilder } from './infrastructure/excel/exceljs-stakeholder-import-template-builder.js';
import { StakeholderListsController } from './infrastructure/http/stakeholder-lists.controller.js';
import { createStakeholderListsRouter } from './infrastructure/http/stakeholder-lists.routes.js';
import { StakeholdersController } from './infrastructure/http/stakeholders.controller.js';
import {
  createStakeholdersRouter,
  type StakeholderRoutePermissionScope,
} from './infrastructure/http/stakeholders.routes.js';
import { PrismaStakeholderListMemberRepository } from './infrastructure/prisma/prisma-stakeholder-list-member-repository.js';
import { PrismaStakeholderListProgramResolver } from './infrastructure/prisma/prisma-stakeholder-list-program-resolver.js';
import { PrismaStakeholderListRepository } from './infrastructure/prisma/prisma-stakeholder-list-repository.js';
import { PrismaStakeholderRepository } from './infrastructure/prisma/prisma-stakeholder-repository.js';

export interface StakeholdersModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: StakeholderRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly clock?: () => Date;
}

export function createStakeholdersModule(deps?: StakeholdersModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const stakeholderRepository = new PrismaStakeholderRepository(deps.dbProvider);

  const registerStakeholderUseCase = new RegisterStakeholderUseCase({
    stakeholderRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const editStakeholderUseCase = new EditStakeholderUseCase({
    stakeholderRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const voidStakeholderUseCase = new VoidStakeholderUseCase({
    stakeholderRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const searchStakeholdersUseCase = new SearchStakeholdersUseCase({
    stakeholderReader: stakeholderRepository,
    permissionChecker: deps.permissionChecker,
  });

  const controller = new StakeholdersController({
    registerStakeholderUseCase,
    editStakeholderUseCase,
    voidStakeholderUseCase,
    searchStakeholdersUseCase,
  });

  return createStakeholdersRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export function createStakeholderListsModule(deps?: StakeholdersModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const stakeholderListRepository = new PrismaStakeholderListRepository(deps.dbProvider);
  const stakeholderListMemberRepository = new PrismaStakeholderListMemberRepository(
    deps.dbProvider,
  );
  const stakeholderRepository = new PrismaStakeholderRepository(deps.dbProvider);
  const programResolver = new PrismaStakeholderListProgramResolver(deps.dbProvider);

  const createStakeholderListUseCase = new CreateStakeholderListUseCase({
    stakeholderListRepository,
    programResolver,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const addStakeholderListMemberUseCase = new AddStakeholderListMemberUseCase({
    stakeholderListRepository,
    stakeholderListMemberRepository,
    stakeholderRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const copyStakeholderListToNewYearUseCase = new CopyStakeholderListToNewYearUseCase({
    stakeholderListRepository,
    stakeholderListMemberRepository,
    stakeholderLookup: stakeholderRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const listStakeholderListsUseCase = new ListStakeholderListsUseCase({
    stakeholderListReader: stakeholderListRepository,
    permissionChecker: deps.permissionChecker,
  });

  const fileReader = new ExcelJsStakeholderImportFileReader();
  const previewStakeholderImportUseCase = new PreviewStakeholderImportUseCase({
    stakeholderListRepository,
    stakeholderListMemberRepository,
    stakeholderDocumentLookup: stakeholderRepository,
    fileReader,
    permissionChecker: deps.permissionChecker,
    clock: deps.clock,
  });

  const confirmStakeholderImportUseCase = new ConfirmStakeholderImportUseCase({
    stakeholderListRepository,
    stakeholderListMemberRepository,
    stakeholderRepository,
    stakeholderDocumentLookup: stakeholderRepository,
    fileReader,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const templateBuilder = new ExcelJsStakeholderImportTemplateBuilder();
  const downloadStakeholderImportTemplateUseCase = new DownloadStakeholderImportTemplateUseCase({
    templateBuilder,
    permissionChecker: deps.permissionChecker,
  });

  const controller = new StakeholderListsController({
    createStakeholderListUseCase,
    addStakeholderListMemberUseCase,
    copyStakeholderListToNewYearUseCase,
    listStakeholderListsUseCase,
    previewStakeholderImportUseCase,
    confirmStakeholderImportUseCase,
    downloadStakeholderImportTemplateUseCase,
  });

  return createStakeholderListsRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/stakeholder-enums.js';
export * from './domain/entities/stakeholder-list-enums.js';
export * from './domain/entities/stakeholder-list.js';
export * from './domain/entities/stakeholder-list-member.js';
export * from './domain/entities/stakeholder.js';
export * from './domain/policies/stakeholder-list-type-fields.js';
export * from './domain/policies/stakeholder-state-machine.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './infrastructure/prisma/prisma-stakeholder-mapper.js';
export * from './infrastructure/prisma/prisma-stakeholder-repository.js';
export * from './infrastructure/prisma/prisma-stakeholder-list-mapper.js';
export * from './infrastructure/prisma/prisma-stakeholder-list-member-mapper.js';
export * from './infrastructure/prisma/prisma-stakeholder-list-repository.js';
export * from './infrastructure/prisma/prisma-stakeholder-list-member-repository.js';
export * from './infrastructure/prisma/prisma-stakeholder-list-program-resolver.js';
export * from './application/stakeholder-dto.js';
export * from './application/stakeholder-list-dto.js';
export * from './application/add-stakeholder-list-member.js';
export * from './application/add-stakeholder-list-member.types.js';
export * from './application/confirm-stakeholder-import.js';
export * from './application/confirm-stakeholder-import.types.js';
export * from './application/copy-stakeholder-list-to-new-year.js';
export * from './application/copy-stakeholder-list-to-new-year.types.js';
export * from './application/create-stakeholder-list.js';
export * from './application/create-stakeholder-list.types.js';
export * from './application/download-stakeholder-import-template.js';
export * from './application/download-stakeholder-import-template.types.js';
export * from './application/list-stakeholder-lists.js';
export * from './application/list-stakeholder-lists.types.js';
export * from './application/preview-stakeholder-import.js';
export * from './application/preview-stakeholder-import.types.js';
export * from './application/register-stakeholder.js';
export * from './application/register-stakeholder.types.js';
export * from './application/edit-stakeholder.js';
export * from './application/edit-stakeholder.types.js';
export * from './application/void-stakeholder.js';
export * from './application/void-stakeholder.types.js';
export * from './application/search-stakeholders.js';
export * from './application/search-stakeholders.types.js';
export * from './infrastructure/http/stakeholders.controller.js';
export * from './infrastructure/http/stakeholders.routes.js';
export * from './infrastructure/http/stakeholder-lists.controller.js';
export * from './infrastructure/http/stakeholder-lists.routes.js';
