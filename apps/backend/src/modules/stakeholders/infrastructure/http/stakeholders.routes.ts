import { Router, type RequestHandler } from 'express';
import { registerStakeholderRequestSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { StakeholdersController } from './stakeholders.controller.js';

export type StakeholderRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface StakeholdersRouterDependencies {
  readonly controller: StakeholdersController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: StakeholderRoutePermissionScope,
  ) => RequestHandler;
}

export function createStakeholdersRouter(deps: StakeholdersRouterDependencies): Router {
  const router = Router();

  // POST /stakeholders (HU-021, T-021-11, CA1, CA2, RF-021, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('constituyente.editar', 'GLOBAL'),
    validateRequest({ body: registerStakeholderRequestSchema }),
    deps.controller.registerStakeholder,
  );

  return router;
}
