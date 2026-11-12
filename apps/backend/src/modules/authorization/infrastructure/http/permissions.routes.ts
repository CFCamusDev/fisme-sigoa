import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { PermissionsController } from './permissions.controller.js';
import { noQuerySchema } from './roles.schema.js';

export interface PermissionsRouterDependencies {
  readonly controller: PermissionsController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (permission: string, scope?: 'GLOBAL' | 'OWN') => RequestHandler;
}

export function createPermissionsRouter(deps: PermissionsRouterDependencies): Router {
  const router = Router();

  // GET /permissions (T-006-18, RS-002, LS 3.3, D3, D6)
  router.get(
    '/',
    deps.authenticate,
    deps.requirePermission('rol.ver', 'GLOBAL'),
    validateRequest({ query: noQuerySchema }),
    deps.controller.list,
  );

  return router;
}
