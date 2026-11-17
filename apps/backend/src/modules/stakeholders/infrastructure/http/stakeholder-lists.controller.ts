import type { RequestHandler } from 'express';
import type { CreateStakeholderListRequest } from '@sigoa/shared';
import type { CreateStakeholderListUseCase } from '../../application/create-stakeholder-list.js';
import { resolveRequestActor } from './resolve-request-actor.js';

export interface StakeholderListsControllerDependencies {
  readonly createStakeholderListUseCase: CreateStakeholderListUseCase;
}

/** Controlador de `/stakeholder-lists` (HU-022). */
export class StakeholderListsController {
  private readonly createStakeholderListUseCase: CreateStakeholderListUseCase;

  constructor(deps: StakeholderListsControllerDependencies) {
    this.createStakeholderListUseCase = deps.createStakeholderListUseCase;
  }

  createStakeholderList: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const body = req.body as CreateStakeholderListRequest;

      const response = await this.createStakeholderListUseCase.execute({
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
