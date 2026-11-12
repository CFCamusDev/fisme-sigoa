import { Router, type RequestHandler } from 'express';
import { createCatalogVersionRequestSchema, listCatalogVersionsQuerySchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { CatalogVersionsController } from './catalog-versions.controller.js';

export type CatalogRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface CatalogVersionsRouterDependencies {
  readonly controller: CatalogVersionsController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: CatalogRoutePermissionScope,
  ) => RequestHandler;
}

export function createCatalogVersionsRouter(deps: CatalogVersionsRouterDependencies): Router {
  const router = Router();

  // POST /catalog-versions (HU-013, T-013-13, CA1, CA2, RF-013, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('catalogo.editar', 'GLOBAL'),
    validateRequest({
      query: listCatalogVersionsQuerySchema,
      body: createCatalogVersionRequestSchema,
    }),
    deps.controller.createCatalogVersion,
  );

  return router;
}
