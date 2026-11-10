import type { RequestHandler } from 'express';
import type { DefineParametersRequest, ListParametersQuery } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { DefineParametersUseCase } from '../../application/define-parameters.js';
import type { ListEffectiveParametersUseCase } from '../../application/list-effective-parameters.js';

export interface ParameterValuesControllerDependencies {
  readonly defineParametersUseCase: DefineParametersUseCase;
  readonly listEffectiveParametersUseCase: ListEffectiveParametersUseCase;
}

/** Controlador de `/parameters` (HU-011). No confundir con `ParametersController` (`/program`). */
export class ParameterValuesController {
  private readonly defineParametersUseCase: DefineParametersUseCase;
  private readonly listEffectiveParametersUseCase: ListEffectiveParametersUseCase;

  constructor(deps: ParameterValuesControllerDependencies) {
    this.defineParametersUseCase = deps.defineParametersUseCase;
    this.listEffectiveParametersUseCase = deps.listEffectiveParametersUseCase;
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

  listParameters: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const query = getValidated<unknown, unknown, ListParametersQuery>(res).query;
      const response = await this.listEffectiveParametersUseCase.execute({
        actorId,
        semesterCode: query.semesterCode,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
