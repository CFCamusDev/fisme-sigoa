import { Router, type RequestHandler } from 'express';
import {
  createRoleRequestSchema,
  roleIdParamSchema,
  updateRolePermissionsRequestSchema,
} from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { RolesController } from './roles.controller.js';

export interface RolesRouterDependencies {
  readonly controller: RolesController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (permission: string, scope?: 'GLOBAL' | 'OWN') => RequestHandler;
}

export function createRolesRouter(deps: RolesRouterDependencies): Router {
  const router = Router();

  // GET /roles (A2, HU-003, RS-002, LS 3.2, LS 3.3)
  router.get(
    '/',
    deps.authenticate,
    deps.requirePermission('rol.ver', 'GLOBAL'),
    deps.controller.list,
  );

  // POST /roles (T-006-15, RF-006, RS-002, RS-020, RNF-009, RNF-017, D1, D2, D4, D5)
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('rol.editar', 'GLOBAL'),
    validateRequest({ body: createRoleRequestSchema }),
    deps.controller.create,
  );

  // PUT /roles/:id/permissions (T-006-16, RF-006, RS-002, RS-020, RNF-007, RNF-008, RNF-009, RNF-017, D1, D4, D5, D8)
  router.put(
    '/:id/permissions',
    deps.authenticate,
    deps.requirePermission('rol.editar', 'GLOBAL'),
    validateRequest({
      params: roleIdParamSchema,
      body: updateRolePermissionsRequestSchema,
    }),
    deps.controller.updatePermissions,
  );

  return router;
}
