import type { RegisterQualityCommitteeRequest } from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { RegisterQualityCommitteeUseCase } from '../../application/register-quality-committee.js';

export interface QualityCommitteeControllerDependencies {
  readonly registerQualityCommitteeUseCase: RegisterQualityCommitteeUseCase;
}

/** HTTP controller for `/quality-committees` (HU-025, RF-025). */
export class QualityCommitteeController {
  private readonly registerQualityCommitteeUseCase: RegisterQualityCommitteeUseCase;

  constructor(deps: QualityCommitteeControllerDependencies) {
    this.registerQualityCommitteeUseCase = deps.registerQualityCommitteeUseCase;
  }

  registerCommittee: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { body } = getValidated<RegisterQualityCommitteeRequest>(res);

      const response = await this.registerQualityCommitteeUseCase.execute({
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
