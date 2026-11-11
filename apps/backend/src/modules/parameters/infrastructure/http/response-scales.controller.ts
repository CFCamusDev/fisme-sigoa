import type { RequestHandler } from 'express';
import type { CreateResponseScaleRequest, UpdateResponseScaleRequest } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { CreateResponseScaleUseCase } from '../../application/create-response-scale.js';
import type { EditResponseScaleUseCase } from '../../application/edit-response-scale.js';

export interface ResponseScalesControllerDependencies {
  readonly createResponseScaleUseCase: CreateResponseScaleUseCase;
  readonly editResponseScaleUseCase: EditResponseScaleUseCase;
}

/** Controlador de `/response-scales` (HU-012). */
export class ResponseScalesController {
  private readonly createResponseScaleUseCase: CreateResponseScaleUseCase;
  private readonly editResponseScaleUseCase: EditResponseScaleUseCase;

  constructor(deps: ResponseScalesControllerDependencies) {
    this.createResponseScaleUseCase = deps.createResponseScaleUseCase;
    this.editResponseScaleUseCase = deps.editResponseScaleUseCase;
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

  editResponseScale: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
      const body = req.body as UpdateResponseScaleRequest;

      const response = await this.editResponseScaleUseCase.execute({
        actorId,
        ip,
        id: req.params['id'] as string,
        name: body.name,
        levels: body.levels,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
