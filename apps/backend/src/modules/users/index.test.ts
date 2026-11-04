import { describe, it, expect } from 'vitest';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { createUsersModule } from './index.js';
import type {
  ActivationEmailSender,
  ActivationTokenIssuer,
  PermissionChecker,
  UserRoleGateway,
} from './domain/ports/index.js';

describe('users module', () => {
  it('creates an express router without dependencies', () => {
    const router = createUsersModule();
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect(typeof router.use).toBe('function');
  });

  it('creates an express router with dependencies injected', () => {
    const dummyDbProvider: DbProvider = {
      get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
    };
    const router = createUsersModule({
      dbProvider: dummyDbProvider,
      unitOfWork: {} as unknown as UnitOfWork,
      auditLogger: {} as unknown as AuditLogger,
      authenticate: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
      permissionChecker: {} as unknown as PermissionChecker,
      userRoleGateway: {} as unknown as UserRoleGateway,
      activationTokenIssuer: {} as unknown as ActivationTokenIssuer,
      activationEmailSender: {} as unknown as ActivationEmailSender,
    });
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});
