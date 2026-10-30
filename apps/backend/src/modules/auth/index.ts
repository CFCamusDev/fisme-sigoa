import type { Router } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { createAuthRouter } from './infrastructure/http/auth.routes.js';

export interface AuthModuleDependencies {
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
}

export function createAuthModule(_deps: AuthModuleDependencies): Router {
  return createAuthRouter();
}
