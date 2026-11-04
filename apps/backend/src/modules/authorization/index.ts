import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import { PermissionAuthorizer } from './application/permission-authorizer.js';
import { createRequirePermission } from './infrastructure/http/require-permission.js';
import { PrismaGrantReader } from './infrastructure/prisma/prisma-grant-reader.js';
import { PrismaUserRoleGateway } from './infrastructure/prisma/prisma-user-role-gateway.js';

export * from './domain/index.js';
export * from './application/index.js';
export * from './infrastructure/http/require-permission.js';
export * from './infrastructure/prisma/prisma-grant-reader.js';
export * from './infrastructure/prisma/prisma-user-role-gateway.js';

export interface AuthorizationModuleServices {
  readonly grantReader: PrismaGrantReader;
  readonly userRoleGateway: PrismaUserRoleGateway;
  readonly authorizer: PermissionAuthorizer;
  readonly requirePermission: ReturnType<typeof createRequirePermission>;
}

export interface AuthorizationModuleDependencies {
  readonly dbProvider: DbProvider;
}

export function createAuthorizationServices(
  deps: AuthorizationModuleDependencies,
): AuthorizationModuleServices {
  const grantReader = new PrismaGrantReader(deps.dbProvider);
  const userRoleGateway = new PrismaUserRoleGateway(deps.dbProvider);
  const authorizer = new PermissionAuthorizer(grantReader);
  const requirePermission = createRequirePermission(authorizer);

  return {
    grantReader,
    userRoleGateway,
    authorizer,
    requirePermission,
  };
}

export const createAuthorizationModule = createAuthorizationServices;
