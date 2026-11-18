import { listSessionsByExecutionQuerySchema, processExecutionIdParamSchema } from '@sigoa/shared';
import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { SessionsController } from './sessions.controller.js';
import type { SessionRoutePermissionScope } from './sessions.routes.js';

export interface ExecutionSessionsRouterDependencies {
  readonly controller: SessionsController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: SessionRoutePermissionScope,
  ) => RequestHandler;
}

export function createExecutionSessionsRouter(deps: ExecutionSessionsRouterDependencies): Router {
  const router = Router();

  // GET /process-executions/:id/sessions (HU-032, T-032-13, RF-032, RS-002, RNF-008, RNF-009)
  router.get(
    '/:id/sessions',
    deps.authenticate,
    deps.requirePermission('sesion.ver', 'GLOBAL'),
    validateRequest({
      params: processExecutionIdParamSchema,
      query: listSessionsByExecutionQuerySchema,
    }),
    deps.controller.listSessionsByExecution,
  );

  return router;
}
