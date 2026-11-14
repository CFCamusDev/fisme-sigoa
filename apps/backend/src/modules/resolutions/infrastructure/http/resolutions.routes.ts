import { Router, type RequestHandler } from 'express';
import { registerResolutionRequestSchema, resolutionIdParamsSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import { resolutionPdfBody } from './resolution-pdf-body.js';
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

  // POST /resolutions/:id/approve (HU-048, T-048-10, CA2, CA3, RF-048, RN-063, RS-020, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> cuerpo PDF -> validateRequest -> controller
  // El cuerpo binario se lee solo tras autenticar y autorizar (D1).
  router.post(
    '/:id/approve',
    deps.authenticate,
    deps.requirePermission('resolucion.aprobar', 'GLOBAL'),
    resolutionPdfBody(),
    validateRequest({ params: resolutionIdParamsSchema }),
    deps.controller.approveResolution,
  );

  return router;
}
