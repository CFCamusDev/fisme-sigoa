import type { Express } from 'express';
import type { AuditLogger } from './shared/audit/audit-logger.js';
import type { UnitOfWork } from './shared/unit-of-work/unit-of-work.js';
import type { DbProvider } from './shared/prisma/prisma-unit-of-work.js';
import type { Env } from './config/env.js';
import { createAuthModule } from './modules/auth/index.js';

export interface AppRoutesDependencies {
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  dbProvider: DbProvider;
  env: Env;
}

export function setupAppRoutes(app: Express, deps: AppRoutesDependencies): void {
  app.use('/auth', createAuthModule(deps));
}
