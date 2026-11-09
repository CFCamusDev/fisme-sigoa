import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import type { ParametersPermissionChecker } from './domain/ports/parameters-permission-checker.js';

export interface ParametersModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (permission: string, scope?: 'GLOBAL' | 'OWN') => RequestHandler;
  readonly permissionChecker: ParametersPermissionChecker;
  readonly logger?: { error: (message: string, error?: unknown) => void };
  readonly clock?: () => Date;
}

export function createParametersModule(deps?: ParametersModuleDependencies): Router {
  const router = Router();
  if (!deps) {
    return router;
  }
  return router;
}

export * from './domain/entities/program.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/edit-program.js';
export * from './application/edit-program.types.js';
export * from './application/get-program.js';
export * from './application/get-program.types.js';
export * from './application/program-dto.js';
export * from './infrastructure/prisma/prisma-program-repository.js';
