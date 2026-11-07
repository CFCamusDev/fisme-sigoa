import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import { CreateRoleUseCase } from './application/create-role.js';
import { EditRolePermissionsUseCase } from './application/edit-role-permissions.js';
import { EditRoleUseCase } from './application/edit-role.js';
import { ChangeRoleStatusUseCase } from './application/change-role-status.js';
import { ListPermissionsUseCase } from './application/list-permissions.js';
import { ListRolesUseCase } from './application/list-roles.js';
import { PermissionAuthorizer } from './application/permission-authorizer.js';
import { createRequirePermission } from './infrastructure/http/require-permission.js';
import { RolesController } from './infrastructure/http/roles.controller.js';
import { createRolesRouter } from './infrastructure/http/roles.routes.js';
import { PermissionsController } from './infrastructure/http/permissions.controller.js';
import { createPermissionsRouter } from './infrastructure/http/permissions.routes.js';
import { PrismaGrantReader } from './infrastructure/prisma/prisma-grant-reader.js';
import { PrismaRoleReader } from './infrastructure/prisma/prisma-role-reader.js';
import { PrismaUserRoleGateway } from './infrastructure/prisma/prisma-user-role-gateway.js';
import { PrismaRoleRepository } from './infrastructure/prisma/prisma-role-repository.js';
import { PrismaPermissionRepository } from './infrastructure/prisma/prisma-permission-repository.js';
import { PrismaRolePermissionRepository } from './infrastructure/prisma/prisma-role-permission-repository.js';

export * from './domain/index.js';
export * from './application/index.js';
export * from './infrastructure/http/require-permission.js';
export * from './infrastructure/http/roles.controller.js';
export * from './infrastructure/http/roles.routes.js';
export * from './infrastructure/http/permissions.controller.js';
export * from './infrastructure/http/permissions.routes.js';
export * from './infrastructure/prisma/prisma-grant-reader.js';
export * from './infrastructure/prisma/prisma-role-reader.js';
export * from './infrastructure/prisma/prisma-role-mapper.js';
export * from './infrastructure/prisma/prisma-role-repository.js';
export * from './infrastructure/prisma/prisma-permission-repository.js';
export * from './infrastructure/prisma/prisma-role-permission-repository.js';
export * from './infrastructure/prisma/prisma-user-role-gateway.js';
export * from './infrastructure/prisma/prisma-user-role-repository.js';
export * from './infrastructure/prisma/prisma-user-access-subject-repository.js';

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
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
}

export function createRolesModule(deps: RolesModuleDependencies): Router {
  const roleRepository = new PrismaRoleRepository(deps.dbProvider);
  const permissionRepository = new PrismaPermissionRepository(deps.dbProvider);
  const rolePermissionRepository = new PrismaRolePermissionRepository(deps.dbProvider);

  const createRoleUseCase = new CreateRoleUseCase({
    roleRepository,
    permissionRepository,
    rolePermissionRepository,
    roleReader: deps.services.roleReader,
    authorizer: deps.services.authorizer,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const editRolePermissionsUseCase = new EditRolePermissionsUseCase({
    roleRepository,
    permissionRepository,
    rolePermissionRepository,
    roleReader: deps.services.roleReader,
    authorizer: deps.services.authorizer,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const editRoleUseCase = new EditRoleUseCase({
    roleRepository,
    roleReader: deps.services.roleReader,
    authorizer: deps.services.authorizer,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const changeRoleStatusUseCase = new ChangeRoleStatusUseCase({
    roleRepository,
    roleReader: deps.services.roleReader,
    authorizer: deps.services.authorizer,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const controller = new RolesController({
    listRolesUseCase: deps.services.listRolesUseCase,
    createRoleUseCase,
    editRolePermissionsUseCase,
    editRoleUseCase,
    changeRoleStatusUseCase,
  });

  return createRolesRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.services.requirePermission,
  });
}

export interface PermissionsModuleDependencies {
  readonly authenticate: RequestHandler;
  readonly services: AuthorizationModuleServices;
  readonly dbProvider: DbProvider;
}

export function createPermissionsModule(deps: PermissionsModuleDependencies): Router {
  const permissionRepository = new PrismaPermissionRepository(deps.dbProvider);
  const listPermissionsUseCase = new ListPermissionsUseCase({
    permissionRepository,
    authorizer: deps.services.authorizer,
  });

  const controller = new PermissionsController({
    listPermissionsUseCase,
  });

  return createPermissionsRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.services.requirePermission,
  });
}

export const createAuthorizationModule = createAuthorizationServices;
