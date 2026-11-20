import type { ProcessExecutionIdParam, SaveScheduleRequest } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { ListScheduleUseCase } from '../../application/list-schedule.js';
import type { ProposeScheduleUseCase } from '../../application/propose-schedule.js';
import type { SaveScheduleUseCase } from '../../application/save-schedule.js';

export interface ScheduleControllerDependencies {
  readonly proposeScheduleUseCase: ProposeScheduleUseCase;
  readonly saveScheduleUseCase: SaveScheduleUseCase;
  readonly listScheduleUseCase: ListScheduleUseCase;
}

/** Controlador HTTP del cronograma de ejecuciones (HU-028). */
export class ScheduleController {
  private readonly proposeScheduleUseCase: ProposeScheduleUseCase;
  private readonly saveScheduleUseCase: SaveScheduleUseCase;
  private readonly listScheduleUseCase: ListScheduleUseCase;

  constructor(deps: ScheduleControllerDependencies) {
    this.proposeScheduleUseCase = deps.proposeScheduleUseCase;
    this.saveScheduleUseCase = deps.saveScheduleUseCase;
    this.listScheduleUseCase = deps.listScheduleUseCase;
  }

  listSchedule: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const { id } = getValidated<unknown, ProcessExecutionIdParam>(res).params;

      const response = await this.listScheduleUseCase.execute({
        actorId,
        executionId: id,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  proposeSchedule: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { id } = getValidated<unknown, ProcessExecutionIdParam>(res).params;

      const response = await this.proposeScheduleUseCase.execute({
        actorId,
        ip,
        executionId: id,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  saveSchedule: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { id } = getValidated<unknown, ProcessExecutionIdParam>(res).params;
      const body = req.body as SaveScheduleRequest;

      const response = await this.saveScheduleUseCase.execute({
        actorId,
        ip,
        executionId: id,
        activities: body.activities,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
