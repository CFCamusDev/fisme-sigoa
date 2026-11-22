import { executionBoardQuerySchema, processExecutionIdParamSchema } from '@sigoa/shared';
import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { ExecutionBoardController } from './execution-board.controller.js';
import type { ProcessRoutePermissionScope } from './process-executions.routes.js';

export interface ExecutionBoardRouterDependencies {
  readonly controller: ExecutionBoardController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ProcessRoutePermissionScope,
  ) => RequestHandler;
}

export function createExecutionBoardRouter(deps: ExecutionBoardRouterDependencies): Router {
  const router = Router();

  // GET /process-executions/:id/board (HU-031, RF-031, RNF-008, RNF-009)
  router.get(
    '/:id/board',
    deps.authenticate,
    deps.requirePermission('ejecucion.ver', 'GLOBAL'),
    validateRequest({
      params: processExecutionIdParamSchema,
      query: executionBoardQuerySchema,
    }),
    deps.controller.getBoard,
  );

  return router;
}
