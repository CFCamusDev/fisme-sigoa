import type {
  CreateSessionRequest,
  ListSessionsByExecutionQuery,
  ProcessExecutionIdParam,
  SessionIdParam,
  UpdateSessionRequest,
} from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { EditSessionUseCase } from '../../application/edit-session.js';
import type { ListSessionsByExecutionUseCase } from '../../application/list-sessions-by-execution.js';
import type { RegisterSessionUseCase } from '../../application/register-session.js';

export interface SessionsControllerDependencies {
  readonly registerSessionUseCase: RegisterSessionUseCase;
  readonly editSessionUseCase: EditSessionUseCase;
  readonly listSessionsByExecutionUseCase: ListSessionsByExecutionUseCase;
}

/** HTTP controller for `/sessions` and `/process-executions/:id/sessions` (HU-032). */
export class SessionsController {
  private readonly registerSessionUseCase: RegisterSessionUseCase;
  private readonly editSessionUseCase: EditSessionUseCase;
  private readonly listSessionsByExecutionUseCase: ListSessionsByExecutionUseCase;

  constructor(deps: SessionsControllerDependencies) {
    this.registerSessionUseCase = deps.registerSessionUseCase;
    this.editSessionUseCase = deps.editSessionUseCase;
    this.listSessionsByExecutionUseCase = deps.listSessionsByExecutionUseCase;
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

  listSessionsByExecution: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const { params, query } = getValidated<
        unknown,
        ProcessExecutionIdParam,
        ListSessionsByExecutionQuery
      >(res);

      const response = await this.listSessionsByExecutionUseCase.execute({
        actorId,
        executionId: params.id,
        page: query.page,
        pageSize: query.pageSize,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
