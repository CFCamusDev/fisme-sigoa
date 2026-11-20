import { Router, type RequestHandler } from 'express';
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

export function createScheduleActivitiesRouter(
  _deps: ScheduleActivitiesRouterDependencies,
): Router {
  const router = Router();
  return router;
}
