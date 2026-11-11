import type { RequestHandler } from 'express';
import type { CreateResponseScaleRequest } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { CreateResponseScaleUseCase } from '../../application/create-response-scale.js';

export interface ResponseScalesControllerDependencies {
  readonly createResponseScaleUseCase: CreateResponseScaleUseCase;
}

/** Controlador de `/response-scales` (HU-012). */
export class ResponseScalesController {
  private readonly createResponseScaleUseCase: CreateResponseScaleUseCase;

  constructor(deps: ResponseScalesControllerDependencies) {
    this.createResponseScaleUseCase = deps.createResponseScaleUseCase;
  }

  createResponseScale: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
      const body = req.body as CreateResponseScaleRequest;

      const response = await this.createResponseScaleUseCase.execute({
        actorId,
        ip,
        code: body.code,
        name: body.name,
        type: body.type,
        levels: body.levels,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };
}
