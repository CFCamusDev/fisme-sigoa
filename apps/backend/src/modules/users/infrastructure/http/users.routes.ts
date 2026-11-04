import { Router, type RequestHandler } from 'express';
import { createUserRequestSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { UsersController } from './users.controller.js';

export type UserRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface UsersRouterDependencies {
  controller: UsersController;
  authenticate: RequestHandler;
  requirePermission: (permission: string, scope?: UserRoutePermissionScope) => RequestHandler;
}

export function createUsersRouter(deps: UsersRouterDependencies): Router {
  const router = Router();

  // POST /users (CA1, CA2, RF-003, RS-002, RS-015, RS-020, D7)
  // Cadena obligatoria de middlewares: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('usuario.crear', 'GLOBAL'),
    validateRequest({ body: createUserRequestSchema }),
    deps.controller.create,
  );

  return router;
}
