import type { RequestHandler } from 'express';
import type {
  AddStakeholderListMemberRequest,
  CopyStakeholderListRequest,
  CreateStakeholderListRequest,
  ListStakeholderListsQuery,
  StakeholderListIdParams,
} from '@sigoa/shared';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { AddStakeholderListMemberUseCase } from '../../application/add-stakeholder-list-member.js';
import type { CopyStakeholderListToNewYearUseCase } from '../../application/copy-stakeholder-list-to-new-year.js';
import type { CreateStakeholderListUseCase } from '../../application/create-stakeholder-list.js';
import type { ListStakeholderListsUseCase } from '../../application/list-stakeholder-lists.js';
import { resolveRequestActor } from './resolve-request-actor.js';

export interface StakeholderListsControllerDependencies {
  readonly createStakeholderListUseCase: CreateStakeholderListUseCase;
  readonly addStakeholderListMemberUseCase: AddStakeholderListMemberUseCase;
  readonly copyStakeholderListToNewYearUseCase: CopyStakeholderListToNewYearUseCase;
  readonly listStakeholderListsUseCase: ListStakeholderListsUseCase;
}

/** Controlador de `/stakeholder-lists` (HU-022). */
export class StakeholderListsController {
  private readonly createStakeholderListUseCase: CreateStakeholderListUseCase;
  private readonly addStakeholderListMemberUseCase: AddStakeholderListMemberUseCase;
  private readonly copyStakeholderListToNewYearUseCase: CopyStakeholderListToNewYearUseCase;
  private readonly listStakeholderListsUseCase: ListStakeholderListsUseCase;

  constructor(deps: StakeholderListsControllerDependencies) {
    this.createStakeholderListUseCase = deps.createStakeholderListUseCase;
    this.addStakeholderListMemberUseCase = deps.addStakeholderListMemberUseCase;
    this.copyStakeholderListToNewYearUseCase = deps.copyStakeholderListToNewYearUseCase;
    this.listStakeholderListsUseCase = deps.listStakeholderListsUseCase;
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

  copyStakeholderList: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { id } = req.params as StakeholderListIdParams;
      const body = req.body as CopyStakeholderListRequest;

      const response = await this.copyStakeholderListToNewYearUseCase.execute({
        sourceListId: id,
        year: body.year,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  listStakeholderLists: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const query = getValidated<unknown, unknown, ListStakeholderListsQuery>(res).query;

      const response = await this.listStakeholderListsUseCase.execute({
        actorId,
        type: query.type,
        year: query.year,
        includeMembers: query.includeMembers,
        page: query.page,
        pageSize: query.pageSize,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
