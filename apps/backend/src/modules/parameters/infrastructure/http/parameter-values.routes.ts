import { Router, type RequestHandler } from 'express';
import { defineParametersRequestSchema } from '@sigoa/shared';
import { z } from 'zod';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { ParameterValuesController } from './parameter-values.controller.js';
import type { ParametersRoutePermissionScope } from './parameters.routes.js';

/** Query vacía: rechaza cualquier parámetro de query (D16). */
const emptyQuerySchema = z.object({}).strict();

export interface ParameterValuesRouterDependencies {
  readonly controller: ParameterValuesController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ParametersRoutePermissionScope,
  ) => RequestHandler;
}

export function createParameterValuesRouter(deps: ParameterValuesRouterDependencies): Router {
  const router = Router();

  // POST /parameters (HU-011, T-011-09, CA2, CA3, RF-011, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('parametro.editar', 'GLOBAL'),
    validateRequest({
      query: emptyQuerySchema,
      body: defineParametersRequestSchema,
    }),
    deps.controller.defineParameters,
  );

  return router;
}
