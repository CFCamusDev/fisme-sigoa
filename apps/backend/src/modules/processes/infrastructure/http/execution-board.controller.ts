import type { ProcessExecutionIdParam } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { GetExecutionBoardUseCase } from '../../application/get-execution-board.js';

export interface ExecutionBoardControllerDependencies {
  readonly getExecutionBoardUseCase: GetExecutionBoardUseCase;
}

/** Controlador HTTP del tablero de una ejecución de proceso (HU-031). */
export class ExecutionBoardController {
  private readonly getExecutionBoardUseCase: GetExecutionBoardUseCase;

  constructor(deps: ExecutionBoardControllerDependencies) {
    this.getExecutionBoardUseCase = deps.getExecutionBoardUseCase;
  }

  getBoard: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const { id } = getValidated<unknown, ProcessExecutionIdParam>(res).params;

      const response = await this.getExecutionBoardUseCase.execute({
        executionId: id,
        actorId,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
