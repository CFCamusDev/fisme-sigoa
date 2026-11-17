import { Router, type RequestHandler } from 'express';
import {
  addStakeholderListMemberRequestSchema,
  copyStakeholderListRequestSchema,
  createStakeholderListRequestSchema,
  stakeholderListIdParamsSchema,
} from '@sigoa/shared';
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

  // POST /stakeholder-lists/:id/members (HU-022, T-022-11, CA1, CA2, RF-022, RS-002, RS-020)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/:id/members',
    deps.authenticate,
    deps.requirePermission('constituyente.editar', 'GLOBAL'),
    validateRequest({
      params: stakeholderListIdParamsSchema,
      body: addStakeholderListMemberRequestSchema,
    }),
    deps.controller.addStakeholderListMember,
  );

  // POST /stakeholder-lists/:id/copy (HU-022, T-022-12, CA3, RF-022, RS-002, RS-020)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/:id/copy',
    deps.authenticate,
    deps.requirePermission('constituyente.editar', 'GLOBAL'),
    validateRequest({
      params: stakeholderListIdParamsSchema,
      body: copyStakeholderListRequestSchema,
    }),
    deps.controller.copyStakeholderList,
  );

  return router;
}
