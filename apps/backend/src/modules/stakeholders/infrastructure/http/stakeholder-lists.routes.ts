import { Router, type RequestHandler } from 'express';
import { createStakeholderListRequestSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { StakeholderListsController } from './stakeholder-lists.controller.js';
import type { StakeholderRoutePermissionScope } from './stakeholders.routes.js';

export interface StakeholderListsRouterDependencies {
  readonly controller: StakeholderListsController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: StakeholderRoutePermissionScope,
  ) => RequestHandler;
}

export function createStakeholderListsRouter(deps: StakeholderListsRouterDependencies): Router {
  const router = Router();

  // POST /stakeholder-lists (HU-022, T-022-10, RF-022, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('constituyente.editar', 'GLOBAL'),
    validateRequest({ body: createStakeholderListRequestSchema }),
    deps.controller.createStakeholderList,
  );

  return router;
}
