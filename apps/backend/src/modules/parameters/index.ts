import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';

export interface ParametersModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (permission: string, scope?: 'GLOBAL' | 'OWN') => RequestHandler;
  readonly permissionChecker: {
    assertAllowed: (params: {
      actorId: string;
      permission: string;
      scope?: 'GLOBAL' | 'OWN';
    }) => Promise<void>;
  };
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
