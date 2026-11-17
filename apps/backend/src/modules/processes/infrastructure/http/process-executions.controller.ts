import type { CreateProcessExecutionRequest } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import type { CreateProcessExecutionUseCase } from '../../application/create-process-execution.js';
import { resolveRequestActor } from './resolve-request-actor.js';

export interface ProcessExecutionsControllerDependencies {
  readonly createProcessExecutionUseCase: CreateProcessExecutionUseCase;
}

/** Controlador HTTP de `/process-executions` (HU-027). */
export class ProcessExecutionsController {
  private readonly createProcessExecutionUseCase: CreateProcessExecutionUseCase;

  constructor(deps: ProcessExecutionsControllerDependencies) {
    this.createProcessExecutionUseCase = deps.createProcessExecutionUseCase;
  }

  createProcessExecution: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const body = req.body as CreateProcessExecutionRequest;

      const response = await this.createProcessExecutionUseCase.execute({
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
