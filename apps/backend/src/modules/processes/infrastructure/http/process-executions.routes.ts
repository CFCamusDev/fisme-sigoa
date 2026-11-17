import {
  createProcessExecutionRequestSchema,
  listProcessExecutionsQuerySchema,
} from '@sigoa/shared';
import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { ProcessExecutionsController } from './process-executions.controller.js';

export type ProcessRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface ProcessExecutionsRouterDependencies {
  readonly controller: ProcessExecutionsController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ProcessRoutePermissionScope,
  ) => RequestHandler;
}

export function createProcessExecutionsRouter(deps: ProcessExecutionsRouterDependencies): Router {
  const router = Router();

  // POST /process-executions (HU-027, T-027-09, RF-027, RS-002, RS-020, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('ejecucion.crear', 'GLOBAL'),
    validateRequest({ body: createProcessExecutionRequestSchema }),
    deps.controller.createProcessExecution,
  );

  // GET /process-executions (HU-027, T-027-10, RF-027, RS-002, RNF-008, RNF-009)
  // Cadena obligatoria: authenticate -> requirePermission -> validateRequest -> controller
  router.get(
    '/',
    deps.authenticate,
    deps.requirePermission('ejecucion.ver', 'GLOBAL'),
    validateRequest({ query: listProcessExecutionsQuerySchema }),
    deps.controller.listProcessExecutions,
  );

  return router;
}
