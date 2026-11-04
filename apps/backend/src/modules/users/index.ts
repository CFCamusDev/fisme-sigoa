import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { CreateUserUseCase } from './application/create-user.js';
import { EditUserUseCase } from './application/edit-user.js';
import { ChangeUserStatusUseCase } from './application/change-user-status.js';
import { ListUsersUseCase } from './application/list-users.js';
import type {
  ActivationEmailSender,
  ActivationTokenIssuer,
  PermissionChecker,
  UserRoleGateway,
} from './domain/ports/index.js';
import { UsersController } from './infrastructure/http/users.controller.js';
import {
  createUsersRouter,
  type UserRoutePermissionScope,
} from './infrastructure/http/users.routes.js';
import { PrismaUserListReader } from './infrastructure/prisma/prisma-user-list-reader.js';
import { PrismaUserRepository } from './infrastructure/prisma/prisma-user-repository.js';
import { PrismaUserSessionRevoker } from './infrastructure/prisma/prisma-user-session-revoker.js';

export interface UsersModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: UserRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: PermissionChecker;
  readonly userRoleGateway: UserRoleGateway;
  readonly activationTokenIssuer: ActivationTokenIssuer;
  readonly activationEmailSender: ActivationEmailSender;
  readonly logger?: { error: (message: string, error?: unknown) => void };
  readonly clock?: () => Date;
}

export function createUsersModule(deps?: UsersModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const userRepository = new PrismaUserRepository(deps.dbProvider);
  const createUserUseCase = new CreateUserUseCase({
    userRepository,
    permissionChecker: deps.permissionChecker,
    userRoleGateway: deps.userRoleGateway,
    activationTokenIssuer: deps.activationTokenIssuer,
    activationEmailSender: deps.activationEmailSender,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    logger: deps.logger,
    clock: deps.clock,
  });

  const editUserUseCase = new EditUserUseCase({
    userRepository,
    userRoleGateway: deps.userRoleGateway,
    permissionChecker: deps.permissionChecker,
    auditLogger: deps.auditLogger,
    unitOfWork: deps.unitOfWork,
  });

  const userSessionRevoker = new PrismaUserSessionRevoker(deps.dbProvider);
  const changeUserStatusUseCase = new ChangeUserStatusUseCase({
    userRepository,
    userRoleGateway: deps.userRoleGateway,
    userSessionRevoker,
    permissionChecker: deps.permissionChecker,
    auditLogger: deps.auditLogger,
    unitOfWork: deps.unitOfWork,
    clock: deps.clock,
  });

  const userListReader = new PrismaUserListReader(deps.dbProvider);
  const listUsersUseCase = new ListUsersUseCase({
    userListReader,
    userRoleGateway: deps.userRoleGateway,
    permissionChecker: deps.permissionChecker,
  });

  const controller = new UsersController({
    createUserUseCase,
    editUserUseCase,
    changeUserStatusUseCase,
    listUsersUseCase,
  });

  return createUsersRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/user.js';
export * from './domain/ports/index.js';
export * from './application/create-user.js';
export * from './application/create-user.types.js';
export * from './application/edit-user.js';
export * from './application/edit-user.types.js';
export * from './application/change-user-status.js';
export * from './application/change-user-status.types.js';
export * from './application/list-users.js';
export * from './application/list-users.types.js';
export * from './application/user-dto.js';
export * from './infrastructure/prisma/prisma-user-repository.js';
export * from './infrastructure/prisma/prisma-user-session-revoker.js';
export * from './infrastructure/email/email-activation-sender.js';
export * from './infrastructure/http/users.controller.js';
export * from './infrastructure/http/users.routes.js';
export * from './infrastructure/http/users.schema.js';
