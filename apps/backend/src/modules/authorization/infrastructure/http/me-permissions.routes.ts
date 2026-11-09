import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { MePermissionsController } from './me-permissions.controller.js';
import { noQuerySchema } from './roles.schema.js';

export interface MePermissionsRouterDependencies {
  readonly controller: MePermissionsController;
  readonly authenticate: RequestHandler;
}

export function createMePermissionsRouter(deps: MePermissionsRouterDependencies): Router {
  const router = Router();

  // GET /me/permissions (HU-008, T-008-04, D4, D7)
  router.get(
    '/permissions',
    deps.authenticate,
    validateRequest({ query: noQuerySchema }),
    deps.controller.getMyPermissions,
  );

  return router;
}
