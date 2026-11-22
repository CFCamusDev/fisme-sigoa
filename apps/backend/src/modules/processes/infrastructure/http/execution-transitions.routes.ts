import {
  advanceProcessExecutionRequestSchema,
  closeProcessExecutionRequestSchema,
  processExecutionIdParamSchema,
  voidProcessExecutionRequestSchema,
} from '@sigoa/shared';
import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { ExecutionTransitionsController } from './execution-transitions.controller.js';
import type { ProcessRoutePermissionScope } from './process-executions.routes.js';

export interface ExecutionTransitionsRouterDependencies {
  readonly controller: ExecutionTransitionsController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ProcessRoutePermissionScope,
  ) => RequestHandler;
}

const normalizeEmptyBody: RequestHandler = (req, _res, next) => {
  if (req.body === undefined) {
    req.body = {};
  }
  next();
};

export function createExecutionTransitionsRouter(
  deps: ExecutionTransitionsRouterDependencies,
): Router {
  const router = Router();

  // GET /process-executions/:id/next-transition (HU-029, T1-D8, RNF-008, RNF-009)
  router.get(
    '/:id/next-transition',
    deps.authenticate,
    deps.requirePermission('ejecucion.ver', 'GLOBAL'),
    validateRequest({
      params: processExecutionIdParamSchema,
    }),
    deps.controller.getNextTransition,
  );

  // POST /process-executions/:id/advance (HU-029, RF-029, RNF-008, RNF-009)
  router.post(
    '/:id/advance',
    deps.authenticate,
    deps.requirePermission('ejecucion.avanzar', 'GLOBAL'),
    normalizeEmptyBody,
    validateRequest({
      params: processExecutionIdParamSchema,
      body: advanceProcessExecutionRequestSchema,
    }),
    deps.controller.advanceProcessExecution,
  );

  // POST /process-executions/:id/close (HU-030, RF-030, RNF-008, RNF-009)
  router.post(
    '/:id/close',
    deps.authenticate,
    deps.requirePermission('ejecucion.cerrar', 'GLOBAL'),
    normalizeEmptyBody,
    validateRequest({
      params: processExecutionIdParamSchema,
      body: closeProcessExecutionRequestSchema,
    }),
    deps.controller.closeProcessExecution,
  );

  // POST /process-executions/:id/void (HU-030, RF-030, RNF-008, RNF-009)
  router.post(
    '/:id/void',
    deps.authenticate,
    deps.requirePermission('ejecucion.anular', 'GLOBAL'),
    validateRequest({
      params: processExecutionIdParamSchema,
      body: voidProcessExecutionRequestSchema,
    }),
    deps.controller.voidProcessExecution,
  );

  return router;
}
