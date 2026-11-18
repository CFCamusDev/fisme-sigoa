import type { CreateSessionRequest, SessionIdParam, UpdateSessionRequest } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { EditSessionUseCase } from '../../application/edit-session.js';
import type { RegisterSessionUseCase } from '../../application/register-session.js';

export interface SessionsControllerDependencies {
  readonly registerSessionUseCase: RegisterSessionUseCase;
  readonly editSessionUseCase: EditSessionUseCase;
}

/** HTTP controller for `/sessions` (HU-032). */
export class SessionsController {
  private readonly registerSessionUseCase: RegisterSessionUseCase;
  private readonly editSessionUseCase: EditSessionUseCase;

  constructor(deps: SessionsControllerDependencies) {
    this.registerSessionUseCase = deps.registerSessionUseCase;
    this.editSessionUseCase = deps.editSessionUseCase;
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

  editSession: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { params, body } = getValidated<UpdateSessionRequest, SessionIdParam>(res);

      const response = await this.editSessionUseCase.execute({
        ...body,
        sessionId: params.id,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
