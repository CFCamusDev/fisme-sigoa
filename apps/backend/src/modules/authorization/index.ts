import { Router, type RequestHandler } from 'express';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import { ListRolesUseCase } from './application/list-roles.js';
import { PermissionAuthorizer } from './application/permission-authorizer.js';
import { createRequirePermission } from './infrastructure/http/require-permission.js';
import { RolesController } from './infrastructure/http/roles.controller.js';
import { createRolesRouter } from './infrastructure/http/roles.routes.js';
import { PrismaGrantReader } from './infrastructure/prisma/prisma-grant-reader.js';
import { PrismaRoleReader } from './infrastructure/prisma/prisma-role-reader.js';
import { PrismaUserRoleGateway } from './infrastructure/prisma/prisma-user-role-gateway.js';

export * from './domain/index.js';
export * from './application/index.js';
export * from './infrastructure/http/require-permission.js';
export * from './infrastructure/http/roles.controller.js';
export * from './infrastructure/http/roles.routes.js';
export * from './infrastructure/prisma/prisma-grant-reader.js';
export * from './infrastructure/prisma/prisma-role-reader.js';
export * from './infrastructure/prisma/prisma-role-mapper.js';
export * from './infrastructure/prisma/prisma-role-repository.js';
export * from './infrastructure/prisma/prisma-permission-repository.js';
export * from './infrastructure/prisma/prisma-user-role-gateway.js';

export interface AuthorizationModuleServices {
  readonly grantReader: PrismaGrantReader;
  readonly roleReader: PrismaRoleReader;
  readonly userRoleGateway: PrismaUserRoleGateway;
  readonly authorizer: PermissionAuthorizer;
  readonly listRolesUseCase: ListRolesUseCase;
  readonly requirePermission: ReturnType<typeof createRequirePermission>;
}

export interface AuthorizationModuleDependencies {
  readonly dbProvider: DbProvider;
}

export function createAuthorizationServices(
  deps: AuthorizationModuleDependencies,
): AuthorizationModuleServices {
  const grantReader = new PrismaGrantReader(deps.dbProvider);
  const roleReader = new PrismaRoleReader(deps.dbProvider);
  const userRoleGateway = new PrismaUserRoleGateway(deps.dbProvider);
  const authorizer = new PermissionAuthorizer(grantReader);
  const listRolesUseCase = new ListRolesUseCase({
    roleReader,
    authorizer,
  });
  const requirePermission = createRequirePermission(authorizer);

  return {
    grantReader,
    roleReader,
    userRoleGateway,
    authorizer,
    listRolesUseCase,
    requirePermission,
  };
}

export interface RolesModuleDependencies {
  readonly authenticate: RequestHandler;
  readonly services: AuthorizationModuleServices;
}

export function createRolesModule(deps: RolesModuleDependencies): Router {
  const controller = new RolesController({
    listRolesUseCase: deps.services.listRolesUseCase,
  });

  return createRolesRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.services.requirePermission,
  });
}

export const createAuthorizationModule = createAuthorizationServices;
