import type { RequestHandler } from 'express';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import type { PermissionScope } from '../../domain/index.js';

export function createRequirePermission(authorizer: PermissionAuthorizer) {
  return (code: string, scope: PermissionScope = 'GLOBAL'): RequestHandler => {
    return async (_req, _res, next) => {
      try {
        const context = getRequestContext();
        const actorId = context?.actor;

        if (!actorId) {
          throw new UnauthorizedError('No autenticado');
        }

        await authorizer.assertAllowed({
          actorId,
          permission: code,
          scope,
        });

        next();
      } catch (error) {
        next(error);
      }
    };
  };
}
