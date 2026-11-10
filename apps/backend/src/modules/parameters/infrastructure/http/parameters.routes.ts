import { Router, type RequestHandler } from 'express';
import { getProgramQuerySchema, updateProgramRequestSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { ParametersController } from './parameters.controller.js';

export type ParametersRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface ParametersRouterDependencies {
  readonly controller: ParametersController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ParametersRoutePermissionScope,
  ) => RequestHandler;
}

export function createParametersRouter(deps: ParametersRouterDependencies): Router {
  const router = Router();

  // GET /program (HU-009, CA1, CA2, RS-002, RS-015, D7, D10)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.get(
    '/',
    deps.authenticate,
    deps.requirePermission('parametro.ver', 'GLOBAL'),
    validateRequest({ query: getProgramQuerySchema }),
    deps.controller.getProgram,
  );

  // PATCH /program (HU-009, CA1, CA2, RF-009, RS-002, RS-020, RNF-008, RNF-009, D7, D10)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.patch(
    '/',
    deps.authenticate,
    deps.requirePermission('parametro.editar', 'GLOBAL'),
    validateRequest({ query: getProgramQuerySchema, body: updateProgramRequestSchema }),
    deps.controller.updateProgram,
  );

  return router;
}
