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

export * from './domain/entities/user.js';
export * from './domain/entities/refresh-token.js';
export * from './domain/value-objects/login-policy.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './infrastructure/security/argon2-password-hasher.js';
export * from './infrastructure/prisma/prisma-user-repository.js';
export * from './infrastructure/prisma/prisma-refresh-token-repository.js';
