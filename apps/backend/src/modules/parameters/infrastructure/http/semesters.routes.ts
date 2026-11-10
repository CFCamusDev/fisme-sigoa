import { Router, type RequestHandler } from 'express';
import { createSemesterRequestSchema, listSemestersQuerySchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { SemestersController } from './semesters.controller.js';
import type { ParametersRoutePermissionScope } from './parameters.routes.js';

export interface SemestersRouterDependencies {
  readonly controller: SemestersController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ParametersRoutePermissionScope,
  ) => RequestHandler;
}

export function createSemestersRouter(deps: SemestersRouterDependencies): Router {
  const router = Router();

  // POST /semesters (HU-010, T-010-07, CA1, CA2, CA3, RF-010, RS-002, RS-020, RNF-008, RNF-009, D1, D2)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('parametro.editar', 'GLOBAL'),
    validateRequest({
      query: listSemestersQuerySchema,
      body: createSemesterRequestSchema,
    }),
    deps.controller.createSemester,
  );

  return router;
}
