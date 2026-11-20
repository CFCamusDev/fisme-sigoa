import {
  processExecutionIdParamSchema,
  proposeScheduleRequestSchema,
  saveScheduleRequestSchema,
} from '@sigoa/shared';
import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { ProcessRoutePermissionScope } from './process-executions.routes.js';
import type { ScheduleController } from './schedule.controller.js';

export interface ExecutionScheduleRouterDependencies {
  readonly controller: ScheduleController;
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

export function createExecutionScheduleRouter(deps: ExecutionScheduleRouterDependencies): Router {
  const router = Router();

  // GET /process-executions/:id/schedule (HU-028, D8, T-028-10, RF-028, RNF-008, RNF-009)
  router.get(
    '/:id/schedule',
    deps.authenticate,
    deps.requirePermission('cronograma.ver', 'GLOBAL'),
    validateRequest({
      params: processExecutionIdParamSchema,
    }),
    deps.controller.listSchedule,
  );

  // POST /process-executions/:id/schedule/propose (HU-028, T-028-09, RF-028, RNF-008, RNF-009)
  router.post(
    '/:id/schedule/propose',
    deps.authenticate,
    deps.requirePermission('cronograma.editar', 'GLOBAL'),
    normalizeEmptyBody,
    validateRequest({
      params: processExecutionIdParamSchema,
      body: proposeScheduleRequestSchema,
    }),
    deps.controller.proposeSchedule,
  );

  // PUT /process-executions/:id/schedule (HU-028, T-028-10, RF-028, RNF-008, RNF-009)
  router.put(
    '/:id/schedule',
    deps.authenticate,
    deps.requirePermission('cronograma.editar', 'GLOBAL'),
    validateRequest({
      params: processExecutionIdParamSchema,
      body: saveScheduleRequestSchema,
    }),
    deps.controller.saveSchedule,
  );

  return router;
}
