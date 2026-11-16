import { Router, type RequestHandler } from 'express';
import {
  editStakeholderRequestSchema,
  registerStakeholderRequestSchema,
  stakeholderIdParamsSchema,
  voidStakeholderRequestSchema,
} from '@sigoa/shared';
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

  // PATCH /stakeholders/:id (HU-021, T-021-12, RF-021, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.patch(
    '/:id',
    deps.authenticate,
    deps.requirePermission('constituyente.editar', 'GLOBAL'),
    validateRequest({ params: stakeholderIdParamsSchema, body: editStakeholderRequestSchema }),
    deps.controller.editStakeholder,
  );

  // POST /stakeholders/:id/void (HU-021, T-021-13, CA3, RF-021, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/:id/void',
    deps.authenticate,
    deps.requirePermission('constituyente.editar', 'GLOBAL'),
    validateRequest({ params: stakeholderIdParamsSchema, body: voidStakeholderRequestSchema }),
    deps.controller.voidStakeholder,
  );

  return router;
}
