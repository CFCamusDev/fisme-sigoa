import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { CreateProcessExecutionUseCase } from './application/create-process-execution.js';
import type { ProcessPermissionChecker } from './domain/ports/process-permission-checker.js';
import { ProcessExecutionsController } from './infrastructure/http/process-executions.controller.js';
import {
  createProcessExecutionsRouter,
  type ProcessRoutePermissionScope,
} from './infrastructure/http/process-executions.routes.js';
import { PrismaProcessCatalogVersionReader } from './infrastructure/prisma/prisma-process-catalog-version-reader.js';
import { PrismaProcessExecutionRepository } from './infrastructure/prisma/prisma-process-execution-repository.js';
import { PrismaProcessProgramResolver } from './infrastructure/prisma/prisma-process-program-resolver.js';
import { PrismaProcessSemesterReader } from './infrastructure/prisma/prisma-process-semester-reader.js';

export interface ProcessesModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ProcessRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly clock?: () => Date;
}

export function createProcessesModule(deps?: ProcessesModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const processExecutionRepository = new PrismaProcessExecutionRepository(deps.dbProvider);
  const programResolver = new PrismaProcessProgramResolver(deps.dbProvider);
  const catalogVersionReader = new PrismaProcessCatalogVersionReader(deps.dbProvider);
  const semesterReader = new PrismaProcessSemesterReader(deps.dbProvider);

  const createProcessExecutionUseCase = new CreateProcessExecutionUseCase({
    processExecutionRepository,
    programResolver,
    catalogVersionReader,
    semesterReader,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const controller = new ProcessExecutionsController({
    createProcessExecutionUseCase,
  });

  return createProcessExecutionsRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/process-execution-status.js';
export * from './domain/entities/process-execution.js';
export * from './domain/entities/process-type.js';
export * from './domain/policies/process-catalog-version-rule.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/process-execution-dto.js';
export * from './application/create-process-execution.js';
export * from './application/create-process-execution.types.js';
export * from './infrastructure/http/process-executions.controller.js';
export * from './infrastructure/http/process-executions.routes.js';
