import {
  changeScheduleActivityStatusRequestSchema,
  scheduleActivityIdParamSchema,
} from '@sigoa/shared';
import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { ProcessRoutePermissionScope } from './process-executions.routes.js';
import type { ScheduleController } from './schedule.controller.js';

export interface ScheduleActivitiesRouterDependencies {
  readonly controller: ScheduleController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: ProcessRoutePermissionScope,
  ) => RequestHandler;
}

export function createScheduleActivitiesRouter(deps: ScheduleActivitiesRouterDependencies): Router {
  const router = Router();

  // PATCH /schedule-activities/:id/status (HU-028, T-028-11, RF-028, RNF-008, RNF-009)
  router.patch(
    '/:id/status',
    deps.authenticate,
    deps.requirePermission('cronograma.editar', 'GLOBAL'),
    validateRequest({
      params: scheduleActivityIdParamSchema,
      body: changeScheduleActivityStatusRequestSchema,
    }),
    deps.controller.changeActivityStatus,
  );

  return router;
}
