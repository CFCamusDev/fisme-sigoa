import type { RequestHandler } from 'express';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { CreateRoleUseCase } from '../../application/create-role.js';
import type { ListRolesUseCase } from '../../application/list-roles.js';

export interface RolesControllerDependencies {
  readonly listRolesUseCase: ListRolesUseCase;
  readonly createRoleUseCase: CreateRoleUseCase;
}

export class RolesController {
  private readonly listRolesUseCase: ListRolesUseCase;
  private readonly createRoleUseCase: CreateRoleUseCase;

  constructor(deps: RolesControllerDependencies) {
    this.listRolesUseCase = deps.listRolesUseCase;
    this.createRoleUseCase = deps.createRoleUseCase;
  }

  list: RequestHandler = async (_req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const response = await this.listRolesUseCase.execute({ actorId });

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const role = await this.createRoleUseCase.execute({
        actorId,
        ip: context.ip,
        input: req.body,
      });

      res.setHeader('Cache-Control', 'no-store');
      res.status(201).json(role);
    } catch (error) {
      next(error);
    }
  };
}
