import type { Request, RequestHandler } from 'express';
import type { RegisterResolutionRequest } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { RegisterResolutionUseCase } from '../../application/register-resolution.js';

export interface ResolutionsControllerDependencies {
  readonly registerResolutionUseCase: RegisterResolutionUseCase;
}

function resolveActor(req: Request): { actorId: string; ip: string } {
  const context = getRequestContext();
  const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;
  if (!actorId) {
    throw new UnauthorizedError('No autenticado');
  }
  const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
  return { actorId, ip };
}

/** Controlador de `/resolutions` (HU-048). */
export class ResolutionsController {
  private readonly registerResolutionUseCase: RegisterResolutionUseCase;

  constructor(deps: ResolutionsControllerDependencies) {
    this.registerResolutionUseCase = deps.registerResolutionUseCase;
  }

  registerResolution: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveActor(req);
      const body = req.body as RegisterResolutionRequest;

      const response = await this.registerResolutionUseCase.execute({
        actorId,
        ip,
        type: body.type,
        number: body.number,
        issuedOn: body.issuedOn,
        catalogVersionId: body.catalogVersionId,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };
}
