import type { CreateSessionRequest } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import type { RegisterSessionUseCase } from '../../application/register-session.js';

export interface SessionsControllerDependencies {
  readonly registerSessionUseCase: RegisterSessionUseCase;
}

/** HTTP controller for `/sessions` (HU-032). */
export class SessionsController {
  private readonly registerSessionUseCase: RegisterSessionUseCase;

  constructor(deps: SessionsControllerDependencies) {
    this.registerSessionUseCase = deps.registerSessionUseCase;
  }

  registerSession: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const body = req.body as CreateSessionRequest;

      const response = await this.registerSessionUseCase.execute({
        ...body,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };
}
