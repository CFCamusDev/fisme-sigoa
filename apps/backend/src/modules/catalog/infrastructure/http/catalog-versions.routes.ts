import { Router, type RequestHandler } from 'express';
import {
  catalogItemsQuerySchema,
  catalogObjectivesRequestSchema,
  catalogVersionIdParamsSchema,
  createCatalogVersionRequestSchema,
  listCatalogVersionsQuerySchema,
} from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { CatalogVersionItemsController } from './catalog-version-items.controller.js';
import type { CatalogVersionsController } from './catalog-versions.controller.js';

export type CatalogRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface CatalogVersionsRouterDependencies {
  readonly controller: CatalogVersionsController;
  readonly itemsController: CatalogVersionItemsController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: CatalogRoutePermissionScope,
  ) => RequestHandler;
}

export function createCatalogVersionsRouter(deps: CatalogVersionsRouterDependencies): Router {
  const router = Router();

  // GET /catalog-versions (HU-013, RF-013, RS-002, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.get(
    '/',
    deps.authenticate,
    deps.requirePermission('catalogo.ver', 'GLOBAL'),
    validateRequest({ query: listCatalogVersionsQuerySchema }),
    deps.controller.listCatalogVersions,
  );

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

  // GET /catalog-versions/:id (HU-014, D8, RF-014, RS-002, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.get(
    '/:id',
    deps.authenticate,
    deps.requirePermission('catalogo.ver', 'GLOBAL'),
    validateRequest({ params: catalogVersionIdParamsSchema, query: catalogItemsQuerySchema }),
    deps.itemsController.getVersionDetail,
  );

  // PUT /catalog-versions/:id/objectives (HU-014, T-014-06, CA1-CA3, RF-014, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.put(
    '/:id/objectives',
    deps.authenticate,
    deps.requirePermission('catalogo.editar', 'GLOBAL'),
    validateRequest({
      params: catalogVersionIdParamsSchema,
      query: catalogItemsQuerySchema,
      body: catalogObjectivesRequestSchema,
    }),
    deps.itemsController.editObjectives,
  );

  return router;
}
