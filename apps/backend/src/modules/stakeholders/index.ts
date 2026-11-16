import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { EditStakeholderUseCase } from './application/edit-stakeholder.js';
import { RegisterStakeholderUseCase } from './application/register-stakeholder.js';
import { VoidStakeholderUseCase } from './application/void-stakeholder.js';
import type { StakeholderPermissionChecker } from './domain/ports/stakeholder-permission-checker.js';
import { StakeholdersController } from './infrastructure/http/stakeholders.controller.js';
import {
  createStakeholdersRouter,
  type StakeholderRoutePermissionScope,
} from './infrastructure/http/stakeholders.routes.js';
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

  const controller = new StakeholdersController({
    registerStakeholderUseCase,
    editStakeholderUseCase,
    voidStakeholderUseCase,
  });

  return createStakeholdersRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/stakeholder-enums.js';
export * from './domain/entities/stakeholder.js';
export * from './domain/policies/stakeholder-state-machine.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './infrastructure/prisma/prisma-stakeholder-mapper.js';
export * from './infrastructure/prisma/prisma-stakeholder-repository.js';
export * from './application/stakeholder-dto.js';
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
