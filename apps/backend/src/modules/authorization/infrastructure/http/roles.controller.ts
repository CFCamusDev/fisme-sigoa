import type { RequestHandler } from 'express';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { ListRolesUseCase } from '../../application/list-roles.js';

export interface RolesControllerDependencies {
  readonly listRolesUseCase: ListRolesUseCase;
}

export class RolesController {
  private readonly listRolesUseCase: ListRolesUseCase;

  constructor(deps: RolesControllerDependencies) {
    this.listRolesUseCase = deps.listRolesUseCase;
  }

  list: RequestHandler = async (_req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const response = await this.listRolesUseCase.execute({ actorId });

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
