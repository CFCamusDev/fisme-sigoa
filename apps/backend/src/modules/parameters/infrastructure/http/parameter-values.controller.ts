import type { RequestHandler } from 'express';
import type { DefineParametersRequest } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { DefineParametersUseCase } from '../../application/define-parameters.js';

export interface ParameterValuesControllerDependencies {
  readonly defineParametersUseCase: DefineParametersUseCase;
}

/** Controlador de `/parameters` (HU-011). No confundir con `ParametersController` (`/program`). */
export class ParameterValuesController {
  private readonly defineParametersUseCase: DefineParametersUseCase;

  constructor(deps: ParameterValuesControllerDependencies) {
    this.defineParametersUseCase = deps.defineParametersUseCase;
  }

  defineParameters: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
      const body = req.body as DefineParametersRequest;

      const response = await this.defineParametersUseCase.execute({
        actorId,
        ip,
        semesterCode: body.semesterCode,
        values: body.values,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };
}
