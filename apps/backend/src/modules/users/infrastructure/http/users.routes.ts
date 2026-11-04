import { Router, type RequestHandler } from 'express';
import {
  changeUserStatusRequestSchema,
  createUserRequestSchema,
  listUsersQuerySchema,
  updateUserRequestSchema,
} from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { UsersController } from './users.controller.js';
import { userParamSchema } from './users.schema.js';

export type UserRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface UsersRouterDependencies {
  controller: UsersController;
  authenticate: RequestHandler;
  requirePermission: (permission: string, scope?: UserRoutePermissionScope) => RequestHandler;
}

export function createUsersRouter(deps: UsersRouterDependencies): Router {
  const router = Router();

  // GET /users (CA4, RF-003, RS-002, RS-015, RS-020, D10)
  router.get(
    '/',
    deps.authenticate,
    deps.requirePermission('usuario.ver', 'GLOBAL'),
    validateRequest({ query: listUsersQuerySchema }),
    deps.controller.list,
  );

  // POST /users (CA1, CA2, RF-003, RS-002, RS-015, RS-020, D7)
  // Cadena obligatoria de middlewares: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('usuario.crear', 'GLOBAL'),
    validateRequest({ body: createUserRequestSchema }),
    deps.controller.create,
  );

  // PATCH /users/:id/status (CA3, RF-003, RS-002, RS-015, RS-020, D7)
  // Declarado antes de /:id para evitar ambigüedades en Express
  router.patch(
    '/:id/status',
    deps.authenticate,
    deps.requirePermission('usuario.editar', 'GLOBAL'),
    validateRequest({ params: userParamSchema, body: changeUserStatusRequestSchema }),
    deps.controller.changeStatus,
  );

  // PATCH /users/:id (CA3, RF-003, RS-002, RS-015, RS-020, D7)
  router.patch(
    '/:id',
    deps.authenticate,
    deps.requirePermission('usuario.editar', 'GLOBAL'),
    validateRequest({ params: userParamSchema, body: updateUserRequestSchema }),
    deps.controller.update,
  );

  return router;
}
