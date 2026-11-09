import type { RequestHandler } from 'express';
import { myPermissionsResponseSchema } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { GetMyPermissionsUseCase } from '../../application/get-my-permissions.js';

export interface MePermissionsControllerDependencies {
  readonly getMyPermissionsUseCase: GetMyPermissionsUseCase;
}

export class MePermissionsController {
  private readonly getMyPermissionsUseCase: GetMyPermissionsUseCase;

  public constructor(deps: MePermissionsControllerDependencies) {
    this.getMyPermissionsUseCase = deps.getMyPermissionsUseCase;
  }

  public getMyPermissions: RequestHandler = async (_req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const response = await this.getMyPermissionsUseCase.execute({ actorId });
      const parsedResponse = myPermissionsResponseSchema.parse(response);

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsedResponse);
    } catch (error) {
      next(error);
    }
  };
}
