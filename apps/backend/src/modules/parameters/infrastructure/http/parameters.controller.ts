import type { RequestHandler } from 'express';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { GetProgramUseCase } from '../../application/get-program.js';
import type { EditProgramUseCase } from '../../application/edit-program.js';

export interface ParametersControllerDependencies {
  readonly getProgramUseCase: GetProgramUseCase;
  readonly editProgramUseCase?: EditProgramUseCase;
}

export class ParametersController {
  private readonly getProgramUseCase: GetProgramUseCase;
  private readonly editProgramUseCase?: EditProgramUseCase;

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
}
