import type { RequestHandler } from 'express';
import type { UpdateProgramRequest } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { EditProgramUseCase } from '../../application/edit-program.js';
import type { GetProgramUseCase } from '../../application/get-program.js';

export interface ParametersControllerDependencies {
  readonly getProgramUseCase: GetProgramUseCase;
  readonly editProgramUseCase: EditProgramUseCase;
}

export class ParametersController {
  private readonly getProgramUseCase: GetProgramUseCase;
  private readonly editProgramUseCase: EditProgramUseCase;

  constructor(deps: ParametersControllerDependencies) {
    this.getProgramUseCase = deps.getProgramUseCase;
    this.editProgramUseCase = deps.editProgramUseCase;
  }

  getProgram: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const dto = await this.getProgramUseCase.execute({ actorId });

      res.setHeader('Cache-Control', 'no-store').status(200).json(dto);
    } catch (error) {
      next(error);
    }
  };

  updateProgram: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
      const body = req.body as UpdateProgramRequest;

      const dto = await this.editProgramUseCase.execute({
        actorId,
        ip,
        code: body.code,
        name: body.name,
        faculty: body.faculty,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(dto);
    } catch (error) {
      next(error);
    }
  };
}
