import type { RequestHandler } from 'express';
import { listPermissionsResponseSchema } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { ListPermissionsUseCase } from '../../application/list-permissions.js';

export interface PermissionsControllerDependencies {
  readonly listPermissionsUseCase: ListPermissionsUseCase;
}

export class PermissionsController {
  private readonly listPermissionsUseCase: ListPermissionsUseCase;

  constructor(deps: PermissionsControllerDependencies) {
    this.listPermissionsUseCase = deps.listPermissionsUseCase;
  }

  list: RequestHandler = async (_req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const response = await this.listPermissionsUseCase.execute({ actorId });
      const parsedResponse = listPermissionsResponseSchema.parse(response);

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsedResponse);
    } catch (error) {
      next(error);
    }
  };
}
