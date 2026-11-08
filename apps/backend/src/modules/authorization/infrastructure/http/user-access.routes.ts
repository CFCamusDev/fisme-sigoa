import { Router, type RequestHandler } from 'express';
import {
  assignUserPermissionsRequestSchema,
  assignUserRolesRequestSchema,
  userIdParamSchema,
} from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { UserAccessController } from './user-access.controller.js';

export interface UserAccessRouterDependencies {
  readonly controller: UserAccessController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (permission: string, scope?: 'GLOBAL' | 'OWN') => RequestHandler;
}

export function createUserAccessRouter(deps: UserAccessRouterDependencies): Router {
  const router = Router();

  // PUT /users/:id/roles (T-007-11, RF-007, RS-002, RS-020, RNF-009, RNF-017, D1, D4, D5, D6)
  router.put(
    '/:id/roles',
    deps.authenticate,
    deps.requirePermission('usuario.editar', 'GLOBAL'),
    validateRequest({
      params: userIdParamSchema,
      body: assignUserRolesRequestSchema,
    }),
    deps.controller.assignRoles,
  );

  // PUT /users/:id/permissions (T-007-12, RF-007, RS-002, RS-020, RNF-009, RNF-017, D1, D4, D5, D6)
  router.put(
    '/:id/permissions',
    deps.authenticate,
    deps.requirePermission('permiso.asignar', 'GLOBAL'),
    validateRequest({
      params: userIdParamSchema,
      body: assignUserPermissionsRequestSchema,
    }),
    deps.controller.assignPermissions,
  );

  return router;
}
