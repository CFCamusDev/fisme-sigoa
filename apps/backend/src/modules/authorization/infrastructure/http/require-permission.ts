import type { Request, RequestHandler } from 'express';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import type { PermissionScope } from '../../domain/index.js';

function resolveRouteTemplate(req: Request): string {
  const baseUrl = req.baseUrl ?? '';
  const routePath = typeof req.route?.path === 'string' ? req.route.path : '';

  if (routePath === '/' && baseUrl) {
    return baseUrl;
  }

  const combined = `${baseUrl}${routePath}`;
  if (combined) {
    return combined;
  }

  return req.path || '/';
}

export function createRequirePermission(authorizer: PermissionAuthorizer) {
  return (code: string, scope: PermissionScope = 'GLOBAL'): RequestHandler => {
    return async (req, _res, next) => {
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
          meta: {
            method: req.method,
            route: resolveRouteTemplate(req),
          },
        });

        next();
      } catch (error) {
        next(error);
      }
    };
  };
}
