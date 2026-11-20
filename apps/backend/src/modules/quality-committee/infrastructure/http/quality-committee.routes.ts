import {
  qualityCommitteeIdParamSchema,
  registerQualityCommitteeRequestSchema,
  replaceCommitteeMembersRequestSchema,
} from '@sigoa/shared';
import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import type { QualityCommitteeController } from './quality-committee.controller.js';

export type QualityCommitteeRoutePermissionScope = 'GLOBAL' | 'OWN';

export interface QualityCommitteeRouterDependencies {
  readonly controller: QualityCommitteeController;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: QualityCommitteeRoutePermissionScope,
  ) => RequestHandler;
}

export function createQualityCommitteeRouter(deps: QualityCommitteeRouterDependencies): Router {
  const router = Router();

  // POST /quality-committees (HU-025, T-025-13, RF-025, RS-002, RS-020, RNF-008, RNF-009)
  router.post(
    '/',
    deps.authenticate,
    deps.requirePermission('comite.editar', 'GLOBAL'),
    validateRequest({ body: registerQualityCommitteeRequestSchema }),
    deps.controller.registerCommittee,
  );

  // PUT /quality-committees/:id/members (HU-025, T-025-14, RF-025, RS-002, RS-020, RNF-008, RNF-009)
  router.put(
    '/:id/members',
    deps.authenticate,
    deps.requirePermission('comite.editar', 'GLOBAL'),
    validateRequest({
      params: qualityCommitteeIdParamSchema,
      body: replaceCommitteeMembersRequestSchema,
    }),
    deps.controller.replaceMembers,
  );

  return router;
}
