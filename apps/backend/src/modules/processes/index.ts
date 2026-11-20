import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { CreateProcessExecutionUseCase } from './application/create-process-execution.js';
import { ListProcessExecutionsUseCase } from './application/list-process-executions.js';
import { ListScheduleUseCase } from './application/list-schedule.js';
import { ProposeScheduleUseCase } from './application/propose-schedule.js';
import { SaveScheduleUseCase } from './application/save-schedule.js';
import type { ProcessPermissionChecker } from './domain/ports/process-permission-checker.js';
import { createExecutionScheduleRouter } from './infrastructure/http/execution-schedule.routes.js';
import { ProcessExecutionsController } from './infrastructure/http/process-executions.controller.js';
import {
  createProcessExecutionsRouter,
  type ProcessRoutePermissionScope,
} from './infrastructure/http/process-executions.routes.js';
import { createScheduleActivitiesRouter } from './infrastructure/http/schedule-activities.routes.js';
import { ScheduleController } from './infrastructure/http/schedule.controller.js';
import { PrismaProcessCatalogVersionReader } from './infrastructure/prisma/prisma-process-catalog-version-reader.js';
import { PrismaProcessExecutionRepository } from './infrastructure/prisma/prisma-process-execution-repository.js';
import { PrismaProcessProgramResolver } from './infrastructure/prisma/prisma-process-program-resolver.js';
import { PrismaProcessSemesterReader } from './infrastructure/prisma/prisma-process-semester-reader.js';
import { PrismaScheduleActivityRepository } from './infrastructure/prisma/prisma-schedule-activity-repository.js';
import { PrismaScheduleExecutionLocker } from './infrastructure/prisma/prisma-schedule-execution-locker.js';

export interface ProcessesModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ProcessRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly clock?: () => Date;
}

export interface ProcessesModuleRouters {
  readonly processExecutions: Router;
  readonly executionSchedule: Router;
  readonly scheduleActivities: Router;
}

export function createProcessesModule(deps?: ProcessesModuleDependencies): ProcessesModuleRouters {
  if (!deps) {
    return {
      processExecutions: Router(),
      executionSchedule: Router(),
      scheduleActivities: Router(),
    };
  }

  const processExecutionRepository = new PrismaProcessExecutionRepository(deps.dbProvider);
  const programResolver = new PrismaProcessProgramResolver(deps.dbProvider);
  const catalogVersionReader = new PrismaProcessCatalogVersionReader(deps.dbProvider);
  const semesterReader = new PrismaProcessSemesterReader(deps.dbProvider);
  const scheduleActivityRepository = new PrismaScheduleActivityRepository(deps.dbProvider);
  const scheduleExecutionLocker = new PrismaScheduleExecutionLocker(deps.dbProvider);

  const createProcessExecutionUseCase = new CreateProcessExecutionUseCase({
    processExecutionRepository,
    programResolver,
    catalogVersionReader,
    semesterReader,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const listProcessExecutionsUseCase = new ListProcessExecutionsUseCase({
    processExecutionReader: processExecutionRepository,
    permissionChecker: deps.permissionChecker,
  });

  const proposeScheduleUseCase = new ProposeScheduleUseCase({
    scheduleExecutionLocker,
    scheduleActivityRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const saveScheduleUseCase = new SaveScheduleUseCase({
    scheduleExecutionLocker,
    scheduleActivityRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const listScheduleUseCase = new ListScheduleUseCase({
    processExecutionReader: processExecutionRepository,
    scheduleActivityRepository,
    permissionChecker: deps.permissionChecker,
    clock: deps.clock,
  });

  const controller = new ProcessExecutionsController({
    createProcessExecutionUseCase,
    listProcessExecutionsUseCase,
  });

  const scheduleController = new ScheduleController({
    proposeScheduleUseCase,
    saveScheduleUseCase,
    listScheduleUseCase,
  });

  return {
    processExecutions: createProcessExecutionsRouter({
      controller,
      authenticate: deps.authenticate,
      requirePermission: deps.requirePermission,
    }),
    executionSchedule: createExecutionScheduleRouter({
      controller: scheduleController,
      authenticate: deps.authenticate,
      requirePermission: deps.requirePermission,
    }),
    scheduleActivities: createScheduleActivitiesRouter({
      controller: scheduleController,
      authenticate: deps.authenticate,
      requirePermission: deps.requirePermission,
    }),
  };
}

export * from './domain/entities/process-execution-status.js';
export * from './domain/entities/process-execution.js';
export * from './domain/entities/process-type.js';
export * from './domain/entities/schedule-activity-status.js';
export * from './domain/entities/schedule-activity.js';
export * from './domain/policies/procedure-steps.js';
export * from './domain/policies/process-catalog-version-rule.js';
export * from './domain/policies/schedule-execution-rule.js';
export * from './domain/policies/schedule-overdue.js';
export * from './domain/policies/schedule-reconciliation.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/process-execution-dto.js';
export * from './application/create-process-execution.js';
export * from './application/create-process-execution.types.js';
export * from './application/list-process-executions.js';
export * from './application/list-process-executions.types.js';
export * from './application/schedule-activity-dto.js';
export * from './application/propose-schedule.js';
export * from './application/propose-schedule.types.js';
export * from './application/save-schedule.js';
export * from './application/save-schedule.types.js';
export * from './application/list-schedule.js';
export * from './application/list-schedule.types.js';
export * from './application/change-schedule-activity-status.js';
export * from './application/change-schedule-activity-status.types.js';
export * from './infrastructure/http/process-executions.controller.js';
export * from './infrastructure/http/process-executions.routes.js';
export * from './infrastructure/http/schedule.controller.js';
export * from './infrastructure/http/execution-schedule.routes.js';
export * from './infrastructure/http/schedule-activities.routes.js';
