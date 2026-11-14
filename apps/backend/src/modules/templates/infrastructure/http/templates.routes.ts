import { Router, type RequestHandler } from 'express';
import { listTemplatesQuerySchema, templateIdParamsSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { TemplatesController } from './templates.controller.js';

export type TemplateRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface TemplatesRouterDependencies {
  readonly controller: TemplatesController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: TemplateRoutePermissionScope,
  ) => RequestHandler;
}

export function createTemplatesRouter(deps: TemplatesRouterDependencies): Router {
  const router = Router();

  // GET /templates (HU-018, T-018-14, CA1, RF-018, RS-002, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.get(
    '/',
    deps.authenticate,
    deps.requirePermission('plantilla.ver', 'GLOBAL'),
    validateRequest({ query: listTemplatesQuerySchema }),
    deps.controller.listTemplates,
  );

  // GET /templates/:id (HU-018, T-018-14, RF-018, RS-002, RNF-008, RNF-009): detalle para el editor
  router.get(
    '/:id',
    deps.authenticate,
    deps.requirePermission('plantilla.ver', 'GLOBAL'),
    validateRequest({ params: templateIdParamsSchema }),
    deps.controller.getTemplate,
  );

  return router;
}
