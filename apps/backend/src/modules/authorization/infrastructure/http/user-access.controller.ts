import type { RequestHandler } from 'express';
import {
  userAccessSchema,
  type AssignUserPermissionsRequest,
  type AssignUserRolesRequest,
} from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { AssignUserRolesUseCase } from '../../application/assign-user-roles.js';
import type { AssignUserPermissionsUseCase } from '../../application/assign-user-permissions.js';
import type { GetUserEffectiveAccessUseCase } from '../../application/get-user-effective-access.js';

export interface UserAccessControllerDependencies {
  readonly assignUserRolesUseCase: AssignUserRolesUseCase;
  readonly assignUserPermissionsUseCase?: AssignUserPermissionsUseCase;
  readonly getUserEffectiveAccessUseCase?: GetUserEffectiveAccessUseCase;
}

export class UserAccessController {
  private readonly assignUserRolesUseCase: AssignUserRolesUseCase;
  private readonly assignUserPermissionsUseCase?: AssignUserPermissionsUseCase;
  private readonly getUserEffectiveAccessUseCase?: GetUserEffectiveAccessUseCase;

  constructor(deps: UserAccessControllerDependencies) {
    this.assignUserRolesUseCase = deps.assignUserRolesUseCase;
    this.assignUserPermissionsUseCase = deps.assignUserPermissionsUseCase;
    this.getUserEffectiveAccessUseCase = deps.getUserEffectiveAccessUseCase;
  }

  assignRoles: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const { id } = req.params as { id: string };
      const { roleIds } = req.body as AssignUserRolesRequest;

      const result = await this.assignUserRolesUseCase.execute({
        actorId,
        userId: id,
        ip: context.ip,
        input: { roleIds },
      });

      const parsedResponse = userAccessSchema.parse(result);

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsedResponse);
    } catch (error) {
      next(error);
    }
  };

  assignPermissions: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      if (!this.assignUserPermissionsUseCase) {
        throw new Error('AssignUserPermissionsUseCase no configurado');
      }

      const { id } = req.params as { id: string };
      const { permissions } = req.body as AssignUserPermissionsRequest;

      const result = await this.assignUserPermissionsUseCase.execute({
        actorId,
        userId: id,
        ip: context.ip,
        input: { permissions },
      });

      const parsedResponse = userAccessSchema.parse(result);

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsedResponse);
    } catch (error) {
      next(error);
    }
  };
}
