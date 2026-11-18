import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { EditSessionUseCase } from './application/edit-session.js';
import { ListSessionsByExecutionUseCase } from './application/list-sessions-by-execution.js';
import { RegisterSessionUseCase } from './application/register-session.js';
import type { SessionPermissionChecker } from './domain/ports/session-permission-checker.js';
import { createExecutionSessionsRouter } from './infrastructure/http/execution-sessions.routes.js';
import { SessionsController } from './infrastructure/http/sessions.controller.js';
import {
  createSessionsRouter,
  type SessionRoutePermissionScope,
} from './infrastructure/http/sessions.routes.js';
import { PrismaSessionExecutionRepository } from './infrastructure/prisma/prisma-session-execution-repository.js';
import { PrismaSessionProcessExecutionReader } from './infrastructure/prisma/prisma-session-process-execution-reader.js';
import { PrismaSessionRepository } from './infrastructure/prisma/prisma-session-repository.js';
import { PrismaSessionStakeholderListReader } from './infrastructure/prisma/prisma-session-stakeholder-list-reader.js';

export interface SessionsModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: SessionRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: SessionPermissionChecker;
  readonly clock?: () => Date;
}

export interface SessionsModuleRouters {
  readonly sessions: Router;
  readonly executionSessions: Router;
}

export function createSessionsModule(deps?: SessionsModuleDependencies): SessionsModuleRouters {
  if (!deps) {
    return { sessions: Router(), executionSessions: Router() };
  }

  const sessionRepository = new PrismaSessionRepository(deps.dbProvider);
  const sessionExecutionRepository = new PrismaSessionExecutionRepository(deps.dbProvider);
  const processExecutionReader = new PrismaSessionProcessExecutionReader(deps.dbProvider);
  const stakeholderListReader = new PrismaSessionStakeholderListReader(deps.dbProvider);

  const registerSessionUseCase = new RegisterSessionUseCase({
    sessionRepository,
    sessionExecutionRepository,
    processExecutionReader,
    stakeholderListReader,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const editSessionUseCase = new EditSessionUseCase({
    sessionRepository,
    sessionExecutionRepository,
    processExecutionReader,
    stakeholderListReader,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const listSessionsByExecutionUseCase = new ListSessionsByExecutionUseCase({
    sessionReader: sessionExecutionRepository,
    processExecutionReader,
    permissionChecker: deps.permissionChecker,
  });

  const controller = new SessionsController({
    registerSessionUseCase,
    editSessionUseCase,
    listSessionsByExecutionUseCase,
  });

  return {
    sessions: createSessionsRouter({
      controller,
      authenticate: deps.authenticate,
      requirePermission: deps.requirePermission,
    }),
    executionSessions: createExecutionSessionsRouter({
      controller,
      authenticate: deps.authenticate,
      requirePermission: deps.requirePermission,
    }),
  };
}

export * from './domain/entities/session-modality.js';
export * from './domain/entities/session-stakeholder-type.js';
export * from './domain/entities/session.js';
export * from './domain/policies/session-execution-rule.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/session-dto.js';
export * from './application/register-session.js';
export * from './application/register-session.types.js';
export * from './application/edit-session.js';
export * from './application/edit-session.types.js';
export * from './application/list-sessions-by-execution.js';
export * from './application/list-sessions-by-execution.types.js';
export * from './infrastructure/http/sessions.controller.js';
export * from './infrastructure/http/sessions.routes.js';
export * from './infrastructure/http/execution-sessions.routes.js';
