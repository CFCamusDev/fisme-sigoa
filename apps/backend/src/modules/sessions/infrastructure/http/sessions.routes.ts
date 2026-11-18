import {
  createSessionRequestSchema,
  registerSessionAttendeesRequestSchema,
  sessionIdParamSchema,
  updateSessionRequestSchema,
} from '@sigoa/shared';
import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { SessionsController } from './sessions.controller.js';

export type SessionRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface SessionsRouterDependencies {
  readonly controller: SessionsController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: SessionRoutePermissionScope,
  ) => RequestHandler;
}

export function createSessionsRouter(deps: SessionsRouterDependencies): Router {
  const router = Router();

  // POST /sessions (HU-032, T-032-11, RF-032, RS-002, RS-020, RNF-008, RNF-009)
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('sesion.editar', 'GLOBAL'),
    validateRequest({ body: createSessionRequestSchema }),
    deps.controller.registerSession,
  );

  // PATCH /sessions/:id (HU-032, T-032-12, RF-032, RS-002, RS-020, RNF-008, RNF-009)
  router.patch(
    '/:id',
    deps.authenticate,
    deps.requirePermission('sesion.editar', 'GLOBAL'),
    validateRequest({ params: sessionIdParamSchema, body: updateSessionRequestSchema }),
    deps.controller.editSession,
  );

  // PUT /sessions/:id/attendees (HU-033, T-033-06, RF-033, RS-002, RS-020, RNF-008, RNF-009)
  router.put(
    '/:id/attendees',
    deps.authenticate,
    deps.requirePermission('sesion.editar', 'GLOBAL'),
    validateRequest({
      params: sessionIdParamSchema,
      body: registerSessionAttendeesRequestSchema,
    }),
    deps.controller.registerAttendees,
  );

  return router;
}
