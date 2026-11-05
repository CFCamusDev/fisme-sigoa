import { Router, type RequestHandler } from 'express';
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

  return router;
}
