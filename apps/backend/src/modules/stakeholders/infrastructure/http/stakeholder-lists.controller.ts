import type { RequestHandler } from 'express';
import type {
  AddStakeholderListMemberRequest,
  CreateStakeholderListRequest,
  StakeholderListIdParams,
} from '@sigoa/shared';
import type { AddStakeholderListMemberUseCase } from '../../application/add-stakeholder-list-member.js';
import type { CreateStakeholderListUseCase } from '../../application/create-stakeholder-list.js';
import { resolveRequestActor } from './resolve-request-actor.js';

export interface StakeholderListsControllerDependencies {
  readonly createStakeholderListUseCase: CreateStakeholderListUseCase;
  readonly addStakeholderListMemberUseCase: AddStakeholderListMemberUseCase;
}

/** Controlador de `/stakeholder-lists` (HU-022). */
export class StakeholderListsController {
  private readonly createStakeholderListUseCase: CreateStakeholderListUseCase;
  private readonly addStakeholderListMemberUseCase: AddStakeholderListMemberUseCase;

  constructor(deps: StakeholderListsControllerDependencies) {
    this.createStakeholderListUseCase = deps.createStakeholderListUseCase;
    this.addStakeholderListMemberUseCase = deps.addStakeholderListMemberUseCase;
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

  addStakeholderListMember: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { id } = req.params as StakeholderListIdParams;
      const body = req.body as AddStakeholderListMemberRequest;

      const response = await this.addStakeholderListMemberUseCase.execute({
        ...body,
        listId: id,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };
}
