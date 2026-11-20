import type {
  QualityCommitteeIdParam,
  QualityCommitteeListQuery,
  RegisterQualityCommitteeRequest,
  ReplaceCommitteeMembersRequest,
} from '@sigoa/shared';
import type { RequestHandler } from 'express';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { GetCurrentQualityCommitteeUseCase } from '../../application/get-current-quality-committee.js';
import type { ListQualityCommitteesUseCase } from '../../application/list-quality-committees.js';
import type { ManageCommitteeMembersUseCase } from '../../application/manage-committee-members.js';
import type { RegisterQualityCommitteeUseCase } from '../../application/register-quality-committee.js';

export interface QualityCommitteeControllerDependencies {
  readonly registerQualityCommitteeUseCase: RegisterQualityCommitteeUseCase;
  readonly manageCommitteeMembersUseCase: ManageCommitteeMembersUseCase;
  readonly getCurrentQualityCommitteeUseCase: GetCurrentQualityCommitteeUseCase;
  readonly listQualityCommitteesUseCase: ListQualityCommitteesUseCase;
}

/** HTTP controller for `/quality-committees` (HU-025, RF-025). */
export class QualityCommitteeController {
  private readonly registerQualityCommitteeUseCase: RegisterQualityCommitteeUseCase;
  private readonly manageCommitteeMembersUseCase: ManageCommitteeMembersUseCase;
  private readonly getCurrentQualityCommitteeUseCase: GetCurrentQualityCommitteeUseCase;
  private readonly listQualityCommitteesUseCase: ListQualityCommitteesUseCase;

  constructor(deps: QualityCommitteeControllerDependencies) {
    this.registerQualityCommitteeUseCase = deps.registerQualityCommitteeUseCase;
    this.manageCommitteeMembersUseCase = deps.manageCommitteeMembersUseCase;
    this.getCurrentQualityCommitteeUseCase = deps.getCurrentQualityCommitteeUseCase;
    this.listQualityCommitteesUseCase = deps.listQualityCommitteesUseCase;
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

  replaceMembers: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { params, body } = getValidated<
        ReplaceCommitteeMembersRequest,
        QualityCommitteeIdParam
      >(res);

      const response = await this.manageCommitteeMembersUseCase.execute({
        committeeId: params.id,
        members: body.members,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  getCurrentCommittee: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const response = await this.getCurrentQualityCommitteeUseCase.execute({ actorId });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  listCommittees: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const { query } = getValidated<unknown, unknown, QualityCommitteeListQuery>(res);

      const response = await this.listQualityCommitteesUseCase.execute({
        actorId,
        page: query.page,
        pageSize: query.pageSize,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
