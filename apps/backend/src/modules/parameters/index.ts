import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { EditProgramUseCase } from './application/edit-program.js';
import { GetProgramUseCase } from './application/get-program.js';
import type { ParametersPermissionChecker } from './domain/ports/parameters-permission-checker.js';
import { ParametersController } from './infrastructure/http/parameters.controller.js';
import {
  createParametersRouter,
  type ParametersRoutePermissionScope,
} from './infrastructure/http/parameters.routes.js';
import { PrismaProgramRepository } from './infrastructure/prisma/prisma-program-repository.js';

export interface ParametersModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ParametersRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: ParametersPermissionChecker;
  readonly logger?: { error: (message: string, error?: unknown) => void };
  readonly clock?: () => Date;
}

export function createParametersModule(deps?: ParametersModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const programRepository = new PrismaProgramRepository(deps.dbProvider);

  const getProgramUseCase = new GetProgramUseCase({
    programReader: programRepository,
    permissionChecker: deps.permissionChecker,
  });

  const editProgramUseCase = new EditProgramUseCase({
    programRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const controller = new ParametersController({
    getProgramUseCase,
    editProgramUseCase,
  });

  return createParametersRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/program.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/edit-program.js';
export * from './application/edit-program.types.js';
export * from './application/get-program.js';
export * from './application/get-program.types.js';
export * from './application/program-dto.js';
export * from './infrastructure/http/parameters.controller.js';
export * from './infrastructure/http/parameters.routes.js';
export * from './infrastructure/prisma/prisma-program-repository.js';
