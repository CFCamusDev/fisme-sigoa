import type { ProcessExecutionIdParam } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { ProposeScheduleUseCase } from '../../application/propose-schedule.js';

export interface ScheduleControllerDependencies {
  readonly proposeScheduleUseCase: ProposeScheduleUseCase;
}

/** Controlador HTTP del cronograma de ejecuciones (HU-028). */
export class ScheduleController {
  private readonly proposeScheduleUseCase: ProposeScheduleUseCase;

  constructor(deps: ScheduleControllerDependencies) {
    this.proposeScheduleUseCase = deps.proposeScheduleUseCase;
  }

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
}
