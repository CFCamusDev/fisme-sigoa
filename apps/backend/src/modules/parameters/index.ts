import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { EditProgramUseCase } from './application/edit-program.js';
import { GetProgramUseCase } from './application/get-program.js';
import { CreateSemesterUseCase } from './application/create-semester.js';
import { DefineParametersUseCase } from './application/define-parameters.js';
import { ListEffectiveParametersUseCase } from './application/list-effective-parameters.js';
import { ListSemestersUseCase } from './application/list-semesters.js';
import { CreateResponseScaleUseCase } from './application/create-response-scale.js';
import { EditResponseScaleUseCase } from './application/edit-response-scale.js';
import { ListResponseScalesUseCase } from './application/list-response-scales.js';
import type { ParametersPermissionChecker } from './domain/ports/parameters-permission-checker.js';
import type { ScaleUsageReader } from './domain/ports/scale-usage-reader.js';
import { NeverUsedScaleUsageReader } from './infrastructure/never-used-scale-usage-reader.js';
import { ParametersController } from './infrastructure/http/parameters.controller.js';
import {
  createParametersRouter,
  type ParametersRoutePermissionScope,
} from './infrastructure/http/parameters.routes.js';
import { ParameterValuesController } from './infrastructure/http/parameter-values.controller.js';
import { createParameterValuesRouter } from './infrastructure/http/parameter-values.routes.js';
import { ResponseScalesController } from './infrastructure/http/response-scales.controller.js';
import { createResponseScalesRouter } from './infrastructure/http/response-scales.routes.js';
import { SemestersController } from './infrastructure/http/semesters.controller.js';
import { createSemestersRouter } from './infrastructure/http/semesters.routes.js';
import { PrismaParameterRepository } from './infrastructure/prisma/prisma-parameter-repository.js';
import { PrismaProgramRepository } from './infrastructure/prisma/prisma-program-repository.js';
import { PrismaResponseScaleRepository } from './infrastructure/prisma/prisma-response-scale-repository.js';
import { PrismaScaleLevelRepository } from './infrastructure/prisma/prisma-scale-level-repository.js';
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
  /** Quién usa una escala; la HU de encuestas lo reemplaza (D4, D25). */
  readonly scaleUsageReader?: ScaleUsageReader;
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

export function createParameterValuesModule(deps?: ParametersModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const parameterRepository = new PrismaParameterRepository(deps.dbProvider);
  const semesterRepository = new PrismaSemesterRepository(deps.dbProvider);

  const defineParametersUseCase = new DefineParametersUseCase({
    parameterRepository,
    semesterReader: semesterRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const listEffectiveParametersUseCase = new ListEffectiveParametersUseCase({
    parameterReader: parameterRepository,
    semesterReader: semesterRepository,
    permissionChecker: deps.permissionChecker,
    clock: deps.clock,
  });

  const controller = new ParameterValuesController({
    defineParametersUseCase,
    listEffectiveParametersUseCase,
  });

  return createParameterValuesRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export function createResponseScalesModule(deps?: ParametersModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const scaleRepository = new PrismaResponseScaleRepository(deps.dbProvider);
  const levelRepository = new PrismaScaleLevelRepository(deps.dbProvider);

  const scaleUsageReader = deps.scaleUsageReader ?? new NeverUsedScaleUsageReader();

  const createResponseScaleUseCase = new CreateResponseScaleUseCase({
    scaleReader: scaleRepository,
    scaleRepository,
    levelRepository,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const editResponseScaleUseCase = new EditResponseScaleUseCase({
    scaleRepository,
    levelRepository,
    scaleUsageReader,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
  });

  const listResponseScalesUseCase = new ListResponseScalesUseCase({
    scaleReader: scaleRepository,
    scaleUsageReader,
    permissionChecker: deps.permissionChecker,
  });

  const controller = new ResponseScalesController({
    createResponseScaleUseCase,
    editResponseScaleUseCase,
    listResponseScalesUseCase,
  });

  return createResponseScalesRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/program.js';
export * from './domain/entities/semester.js';
export * from './domain/entities/parameter.js';
export * from './domain/entities/response-scale.js';
export * from './domain/policies/response-scale-editing-policy.js';
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
export * from './application/list-effective-parameters.js';
export * from './application/list-effective-parameters.types.js';
export * from './infrastructure/http/parameter-values.controller.js';
export * from './infrastructure/http/parameter-values.routes.js';
export * from './infrastructure/prisma/prisma-response-scale-repository.js';
export * from './infrastructure/prisma/prisma-response-scale-mapper.js';
export * from './infrastructure/never-used-scale-usage-reader.js';
export * from './infrastructure/prisma/prisma-scale-level-repository.js';
export * from './application/response-scale-dto.js';
export * from './application/create-response-scale.js';
export * from './application/create-response-scale.types.js';
export * from './application/edit-response-scale.js';
export * from './application/edit-response-scale.types.js';
export * from './application/duplicate-response-scale.js';
export * from './application/duplicate-response-scale.types.js';
export * from './infrastructure/http/response-scales.controller.js';
export * from './infrastructure/http/response-scales.routes.js';
export * from './infrastructure/prisma/seed/response-scale-seed.js';
export * from './application/list-response-scales.js';
export * from './application/list-response-scales.types.js';
