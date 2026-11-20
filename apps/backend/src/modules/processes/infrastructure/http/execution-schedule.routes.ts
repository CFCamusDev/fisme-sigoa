import { processExecutionIdParamSchema, proposeScheduleRequestSchema } from '@sigoa/shared';
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

  return router;
}
