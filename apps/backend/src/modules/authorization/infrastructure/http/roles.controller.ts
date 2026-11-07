import type { RequestHandler } from 'express';
import { listRolesResponseSchema } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { CreateRoleUseCase } from '../../application/create-role.js';
import type { EditRolePermissionsUseCase } from '../../application/edit-role-permissions.js';
import type { ListRolesUseCase } from '../../application/list-roles.js';
import type { EditRoleUseCase } from '../../application/edit-role.js';
import type { ChangeRoleStatusUseCase } from '../../application/change-role-status.js';

export interface RolesControllerDependencies {
  readonly listRolesUseCase: ListRolesUseCase;
  readonly createRoleUseCase: CreateRoleUseCase;
  readonly editRolePermissionsUseCase: EditRolePermissionsUseCase;
  readonly editRoleUseCase: EditRoleUseCase;
  readonly changeRoleStatusUseCase: ChangeRoleStatusUseCase;
}

export class RolesController {
  private readonly listRolesUseCase: ListRolesUseCase;
  private readonly createRoleUseCase: CreateRoleUseCase;
  private readonly editRolePermissionsUseCase: EditRolePermissionsUseCase;
  private readonly editRoleUseCase: EditRoleUseCase;
  private readonly changeRoleStatusUseCase: ChangeRoleStatusUseCase;

  constructor(deps: RolesControllerDependencies) {
    this.listRolesUseCase = deps.listRolesUseCase;
    this.createRoleUseCase = deps.createRoleUseCase;
    this.editRolePermissionsUseCase = deps.editRolePermissionsUseCase;
    this.editRoleUseCase = deps.editRoleUseCase;
    this.changeRoleStatusUseCase = deps.changeRoleStatusUseCase;
  }

  list: RequestHandler = async (_req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const response = await this.listRolesUseCase.execute({ actorId });
      const parsedResponse = listRolesResponseSchema.parse(response);

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsedResponse);
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

  updatePermissions: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const roleId = req.params.id as string;
      const role = await this.editRolePermissionsUseCase.execute({
        actorId,
        ip: context.ip,
        roleId,
        input: req.body,
      });

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(role);
    } catch (error) {
      next(error);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const roleId = req.params.id as string;
      const role = await this.editRoleUseCase.execute({
        actorId,
        ip: context.ip,
        roleId,
        input: req.body,
      });

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(role);
    } catch (error) {
      next(error);
    }
  };

  changeStatus: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const roleId = req.params.id as string;
      const role = await this.changeRoleStatusUseCase.execute({
        actorId,
        ip: context.ip,
        roleId,
        input: req.body,
      });

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(role);
    } catch (error) {
      next(error);
    }
  };
}
