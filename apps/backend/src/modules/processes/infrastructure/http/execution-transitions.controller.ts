import type { ProcessExecutionIdParam } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { AdvanceProcessExecutionUseCase } from '../../application/advance-process-execution.js';
import type { CloseProcessExecutionUseCase } from '../../application/close-process-execution.js';
import type { GetNextTransitionUseCase } from '../../application/get-next-transition.js';

export interface ExecutionTransitionsControllerDependencies {
  readonly advanceProcessExecutionUseCase: AdvanceProcessExecutionUseCase;
  readonly closeProcessExecutionUseCase: CloseProcessExecutionUseCase;
  readonly getNextTransitionUseCase: GetNextTransitionUseCase;
}

/** Controlador HTTP de transiciones de estado de `/process-executions/:id` (HU-029, HU-030). */
export class ExecutionTransitionsController {
  private readonly advanceProcessExecutionUseCase: AdvanceProcessExecutionUseCase;
  private readonly closeProcessExecutionUseCase: CloseProcessExecutionUseCase;
  private readonly getNextTransitionUseCase: GetNextTransitionUseCase;

  constructor(deps: ExecutionTransitionsControllerDependencies) {
    this.advanceProcessExecutionUseCase = deps.advanceProcessExecutionUseCase;
    this.closeProcessExecutionUseCase = deps.closeProcessExecutionUseCase;
    this.getNextTransitionUseCase = deps.getNextTransitionUseCase;
  }

  getNextTransition: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const { id } = getValidated<unknown, ProcessExecutionIdParam>(res).params;

      const response = await this.getNextTransitionUseCase.execute({
        executionId: id,
        actorId,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

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

  closeProcessExecution: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { id } = getValidated<unknown, ProcessExecutionIdParam>(res).params;

      const response = await this.closeProcessExecutionUseCase.execute({
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
