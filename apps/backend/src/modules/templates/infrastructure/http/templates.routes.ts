import { Router, type RequestHandler } from 'express';
import {
  listTemplatesQuerySchema,
  previewTemplateRequestSchema,
  publishTemplateRequestSchema,
  saveTemplateDraftRequestSchema,
  templateIdParamsSchema,
} from '@sigoa/shared';
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

  // PUT /templates/:id/draft (HU-018, T-018-15, CA2, RF-018, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.put(
    '/:id/draft',
    deps.authenticate,
    deps.requirePermission('plantilla.editar', 'GLOBAL'),
    validateRequest({ params: templateIdParamsSchema, body: saveTemplateDraftRequestSchema }),
    deps.controller.saveDraft,
  );

  // POST /templates/:id/publish (HU-018, T-018-16, CA2, CA3, RF-018, RS-002, RS-020, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/:id/publish',
    deps.authenticate,
    deps.requirePermission('plantilla.publicar', 'GLOBAL'),
    validateRequest({ params: templateIdParamsSchema, body: publishTemplateRequestSchema }),
    deps.controller.publishTemplate,
  );

  // POST /templates/:id/preview (HU-019, T-019-04, CA1, CA2, RF-019, RS-002, RNF-008, RNF-009)
  router.post(
    '/:id/preview',
    deps.authenticate,
    deps.requirePermission('plantilla.editar', 'GLOBAL'),
    validateRequest({ params: templateIdParamsSchema, body: previewTemplateRequestSchema }),
    deps.controller.previewTemplate,
  );

  return router;
}
