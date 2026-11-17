import type { CreateProcessExecutionRequest, ListProcessExecutionsQuery } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { CreateProcessExecutionUseCase } from '../../application/create-process-execution.js';
import type { ListProcessExecutionsUseCase } from '../../application/list-process-executions.js';
import { resolveRequestActor } from './resolve-request-actor.js';

export interface ProcessExecutionsControllerDependencies {
  readonly createProcessExecutionUseCase: CreateProcessExecutionUseCase;
  readonly listProcessExecutionsUseCase: ListProcessExecutionsUseCase;
}

/** Controlador HTTP de `/process-executions` (HU-027). */
export class ProcessExecutionsController {
  private readonly createProcessExecutionUseCase: CreateProcessExecutionUseCase;
  private readonly listProcessExecutionsUseCase: ListProcessExecutionsUseCase;

  constructor(deps: ProcessExecutionsControllerDependencies) {
    this.createProcessExecutionUseCase = deps.createProcessExecutionUseCase;
    this.listProcessExecutionsUseCase = deps.listProcessExecutionsUseCase;
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

  listProcessExecutions: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const query = getValidated<unknown, unknown, ListProcessExecutionsQuery>(res).query;

      const response = await this.listProcessExecutionsUseCase.execute({
        actorId,
        type: query.type,
        year: query.year,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
