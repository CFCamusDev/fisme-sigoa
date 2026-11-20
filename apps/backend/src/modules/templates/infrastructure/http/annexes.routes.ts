import { Router, type RequestHandler } from 'express';
import { annexCodeParamsSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { AnnexesController } from './annexes.controller.js';
import type { TemplateRoutePermissionScope } from './templates.routes.js';

export interface AnnexesRouterDependencies {
  readonly controller: AnnexesController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: TemplateRoutePermissionScope,
  ) => RequestHandler;
}

export function createAnnexesRouter(deps: AnnexesRouterDependencies): Router {
  const router = Router();

  // GET /annexes/:code/pdf (HU-070, T-070-04, CA1, CA2, RF-070, RS-002, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.get(
    '/:code/pdf',
    deps.authenticate,
    deps.requirePermission('documento.descargar', 'GLOBAL'),
    validateRequest({ params: annexCodeParamsSchema }),
    deps.controller.downloadPdf,
  );

  return router;
}
