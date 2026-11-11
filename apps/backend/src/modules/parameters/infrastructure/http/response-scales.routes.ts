import { Router, type RequestHandler } from 'express';
import {
  createResponseScaleRequestSchema,
  listResponseScalesQuerySchema,
  responseScaleIdParamSchema,
  updateResponseScaleRequestSchema,
} from '@sigoa/shared';
import { z } from 'zod';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { ParametersRoutePermissionScope } from './parameters.routes.js';
import type { ResponseScalesController } from './response-scales.controller.js';

/** Query vacía: rechaza cualquier parámetro de query. */
const emptyQuerySchema = z.object({}).strict();

export interface ResponseScalesRouterDependencies {
  readonly controller: ResponseScalesController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ParametersRoutePermissionScope,
  ) => RequestHandler;
}

export function createResponseScalesRouter(deps: ResponseScalesRouterDependencies): Router {
  const router = Router();

  // GET /response-scales (HU-012, T-012-14, CA1, CA2, RF-012, RS-002, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.get(
    '/',
    deps.authenticate,
    deps.requirePermission('parametro.ver', 'GLOBAL'),
    validateRequest({
      query: listResponseScalesQuerySchema,
    }),
    deps.controller.listResponseScales,
  );

  // POST /response-scales (HU-012, T-012-11, RF-012, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('parametro.editar', 'GLOBAL'),
    validateRequest({
      query: emptyQuerySchema,
      body: createResponseScaleRequestSchema,
    }),
    deps.controller.createResponseScale,
  );

  // PATCH /response-scales/:id (HU-012, T-012-12, CA3, RF-012, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.patch(
    '/:id',
    deps.authenticate,
    deps.requirePermission('parametro.editar', 'GLOBAL'),
    validateRequest({
      params: responseScaleIdParamSchema,
      query: emptyQuerySchema,
      body: updateResponseScaleRequestSchema,
    }),
    deps.controller.editResponseScale,
  );

  return router;
}
