import { Router, type RequestHandler } from 'express';
import { registerResolutionRequestSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { ResolutionsController } from './resolutions.controller.js';

export type ResolutionRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface ResolutionsRouterDependencies {
  readonly controller: ResolutionsController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ResolutionRoutePermissionScope,
  ) => RequestHandler;
}

export function createResolutionsRouter(deps: ResolutionsRouterDependencies): Router {
  const router = Router();

  // POST /resolutions (HU-048, T-048-09, CA1, RF-048, RN-063, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('resolucion.registrar', 'GLOBAL'),
    validateRequest({ body: registerResolutionRequestSchema }),
    deps.controller.registerResolution,
  );

  return router;
}
