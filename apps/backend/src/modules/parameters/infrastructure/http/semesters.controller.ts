import type { RequestHandler } from 'express';
import type { CreateSemesterRequest } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { CreateSemesterUseCase } from '../../application/create-semester.js';
import type { ListSemestersUseCase } from '../../application/list-semesters.js';

export interface SemestersControllerDependencies {
  readonly createSemesterUseCase: CreateSemesterUseCase;
  readonly listSemestersUseCase?: ListSemestersUseCase;
}

export class SemestersController {
  private readonly createSemesterUseCase: CreateSemesterUseCase;
  private readonly listSemestersUseCase?: ListSemestersUseCase;

  constructor(deps: SemestersControllerDependencies) {
    this.createSemesterUseCase = deps.createSemesterUseCase;
    this.listSemestersUseCase = deps.listSemestersUseCase;
  }

  createSemester: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
      const body = req.body as CreateSemesterRequest;

      const dto = await this.createSemesterUseCase.execute({
        actorId,
        ip,
        code: body.code,
        startDate: body.startDate,
        endDate: body.endDate,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(dto);
    } catch (error) {
      next(error);
    }
  };

  listSemesters: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      if (!this.listSemestersUseCase) {
        throw new Error('ListSemestersUseCase not provided');
      }

      const response = await this.listSemestersUseCase.execute({ actorId });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
