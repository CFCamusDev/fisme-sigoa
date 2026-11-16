import type { Request, RequestHandler } from 'express';
import type {
  EditStakeholderRequest,
  RegisterStakeholderRequest,
  StakeholderIdParams,
  VoidStakeholderRequest,
} from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { EditStakeholderUseCase } from '../../application/edit-stakeholder.js';
import type { RegisterStakeholderUseCase } from '../../application/register-stakeholder.js';
import type { VoidStakeholderUseCase } from '../../application/void-stakeholder.js';

export interface StakeholdersControllerDependencies {
  readonly registerStakeholderUseCase: RegisterStakeholderUseCase;
  readonly editStakeholderUseCase: EditStakeholderUseCase;
  readonly voidStakeholderUseCase: VoidStakeholderUseCase;
}

function resolveActor(req: Request): { actorId: string; ip: string } {
  const context = getRequestContext();
  const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;
  if (!actorId) {
    throw new UnauthorizedError('No autenticado');
  }
  const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
  return { actorId, ip };
}

/** Controlador de `/stakeholders` (HU-021). */
export class StakeholdersController {
  private readonly registerStakeholderUseCase: RegisterStakeholderUseCase;
  private readonly editStakeholderUseCase: EditStakeholderUseCase;
  private readonly voidStakeholderUseCase: VoidStakeholderUseCase;

  constructor(deps: StakeholdersControllerDependencies) {
    this.registerStakeholderUseCase = deps.registerStakeholderUseCase;
    this.editStakeholderUseCase = deps.editStakeholderUseCase;
    this.voidStakeholderUseCase = deps.voidStakeholderUseCase;
  }

  registerStakeholder: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveActor(req);
      const body = req.body as RegisterStakeholderRequest;

      const response = await this.registerStakeholderUseCase.execute({
        ...body,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  editStakeholder: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveActor(req);
      const { id } = req.params as StakeholderIdParams;
      const body = req.body as EditStakeholderRequest;

      const response = await this.editStakeholderUseCase.execute({
        ...body,
        id,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  voidStakeholder: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveActor(req);
      const { id } = req.params as StakeholderIdParams;
      const body = req.body as VoidStakeholderRequest;

      const response = await this.voidStakeholderUseCase.execute({
        id,
        reason: body.reason,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
