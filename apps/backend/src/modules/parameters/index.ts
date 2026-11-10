import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { EditProgramUseCase } from './application/edit-program.js';
import { GetProgramUseCase } from './application/get-program.js';
import { CreateSemesterUseCase } from './application/create-semester.js';
import { ListSemestersUseCase } from './application/list-semesters.js';
import type { ParametersPermissionChecker } from './domain/ports/parameters-permission-checker.js';
import { ParametersController } from './infrastructure/http/parameters.controller.js';
import {
  createParametersRouter,
  type ParametersRoutePermissionScope,
} from './infrastructure/http/parameters.routes.js';
import { SemestersController } from './infrastructure/http/semesters.controller.js';
import { createSemestersRouter } from './infrastructure/http/semesters.routes.js';
import { PrismaProgramRepository } from './infrastructure/prisma/prisma-program-repository.js';
import { PrismaSemesterRepository } from './infrastructure/prisma/prisma-semester-repository.js';

export interface ParametersModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ParametersRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: ParametersPermissionChecker;
  readonly logger?: { error: (message: string, error?: unknown) => void };
  readonly clock?: () => Date;
}

export function createParametersModule(deps?: ParametersModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const programRepository = new PrismaProgramRepository(deps.dbProvider);

  const getProgramUseCase = new GetProgramUseCase({
    programReader: programRepository,
    permissionChecker: deps.permissionChecker,
  });

  const editProgramUseCase = new EditProgramUseCase({
    programRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const controller = new ParametersController({
    getProgramUseCase,
    editProgramUseCase,
  });

  return createParametersRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export function createSemestersModule(deps?: ParametersModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const semesterRepository = new PrismaSemesterRepository(deps.dbProvider);

  const createSemesterUseCase = new CreateSemesterUseCase({
    semesterRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const listSemestersUseCase = new ListSemestersUseCase({
    semesterReader: semesterRepository,
    permissionChecker: deps.permissionChecker,
  });

  const controller = new SemestersController({
    createSemesterUseCase,
    listSemestersUseCase,
  });

  return createSemestersRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/program.js';
export * from './domain/entities/semester.js';
export * from './domain/entities/parameter.js';
export * from './domain/policies/parameter-catalog.js';
export * from './domain/policies/parameter-values-policy.js';
export * from './domain/policies/pick-effective-version.js';
export * from './domain/services/parameter-resolver.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/edit-program.js';
export * from './application/edit-program.types.js';
export * from './application/get-program.js';
export * from './application/get-program.types.js';
export * from './application/program-dto.js';
export * from './application/create-semester.js';
export * from './application/create-semester.types.js';
export * from './application/list-semesters.js';
export * from './application/list-semesters.types.js';
export * from './application/semester-dto.js';

export * from './infrastructure/http/parameters.controller.js';
export * from './infrastructure/http/parameters.routes.js';
export * from './infrastructure/http/semesters.controller.js';
export * from './infrastructure/http/semesters.routes.js';
export * from './infrastructure/prisma/prisma-program-repository.js';
export * from './infrastructure/prisma/prisma-semester-repository.js';
export * from './infrastructure/prisma/prisma-semester-mapper.js';
export * from './infrastructure/prisma/seed/program-seed.js';
export * from './infrastructure/prisma/prisma-parameter-repository.js';
export * from './infrastructure/prisma/prisma-parameter-mapper.js';
export * from './infrastructure/prisma/seed/parameter-seed.js';
export * from './application/define-parameters.js';
export * from './application/define-parameters.types.js';
export * from './application/parameter-dto.js';
export * from './infrastructure/login-attempts-parameter-provider.js';
export * from './domain/policies/find-semester-at.js';
