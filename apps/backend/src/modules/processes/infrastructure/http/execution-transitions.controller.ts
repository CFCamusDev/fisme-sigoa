import type { ProcessExecutionIdParam } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { AdvanceProcessExecutionUseCase } from '../../application/advance-process-execution.js';

export interface ExecutionTransitionsControllerDependencies {
  readonly advanceProcessExecutionUseCase: AdvanceProcessExecutionUseCase;
}

/** Controlador HTTP de transiciones de estado de `/process-executions/:id` (HU-029). */
export class ExecutionTransitionsController {
  private readonly advanceProcessExecutionUseCase: AdvanceProcessExecutionUseCase;

  constructor(deps: ExecutionTransitionsControllerDependencies) {
    this.advanceProcessExecutionUseCase = deps.advanceProcessExecutionUseCase;
  }

  advanceProcessExecution: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { id } = getValidated<unknown, ProcessExecutionIdParam>(res).params;

      const response = await this.advanceProcessExecutionUseCase.execute({
        executionId: id,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
