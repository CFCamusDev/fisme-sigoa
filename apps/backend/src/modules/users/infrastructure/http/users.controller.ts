import type { RequestHandler } from 'express';
import {
  listUsersResponseSchema,
  userDtoSchema,
  type ChangeUserStatusRequest,
  type CreateUserRequest,
  type ListUsersQuery,
  type UpdateUserRequest,
} from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { ChangeUserStatusUseCase } from '../../application/change-user-status.js';
import type { CreateUserUseCase } from '../../application/create-user.js';
import type { EditUserUseCase } from '../../application/edit-user.js';
import type { ListUsersUseCase } from '../../application/list-users.js';

export interface UsersControllerDependencies {
  createUserUseCase: CreateUserUseCase;
  editUserUseCase?: EditUserUseCase;
  changeUserStatusUseCase?: ChangeUserStatusUseCase;
  listUsersUseCase?: ListUsersUseCase;
}

export class UsersController {
  private readonly createUserUseCase: CreateUserUseCase;
  private readonly editUserUseCase?: EditUserUseCase;
  private readonly changeUserStatusUseCase?: ChangeUserStatusUseCase;
  private readonly listUsersUseCase?: ListUsersUseCase;

  constructor(deps: UsersControllerDependencies) {
    this.createUserUseCase = deps.createUserUseCase;
    this.editUserUseCase = deps.editUserUseCase;
    this.changeUserStatusUseCase = deps.changeUserStatusUseCase;
    this.listUsersUseCase = deps.listUsersUseCase;
  }

  create: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const ip = context?.ip ?? (req.ip || req.socket.remoteAddress) ?? '127.0.0.1';

      const dto = await this.createUserUseCase.execute({
        actorId,
        ip,
        input: req.body as CreateUserRequest,
      });

      const parsed = userDtoSchema.parse(dto);

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Location', `/users/${parsed.id}`);
      res.status(201).json(parsed);
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

      if (!this.editUserUseCase) {
        throw new Error('EditUserUseCase no inyectado en UsersController');
      }

      const ip = context?.ip ?? (req.ip || req.socket.remoteAddress) ?? '127.0.0.1';

      const dto = await this.editUserUseCase.execute({
        actorId,
        ip,
        userId: req.params.id as string,
        input: req.body as UpdateUserRequest,
      });

      const parsed = userDtoSchema.parse(dto);

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsed);
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

      if (!this.changeUserStatusUseCase) {
        throw new Error('ChangeUserStatusUseCase no inyectado en UsersController');
      }

      const ip = context?.ip ?? (req.ip || req.socket.remoteAddress) ?? '127.0.0.1';

      const dto = await this.changeUserStatusUseCase.execute({
        actorId,
        ip,
        userId: req.params.id as string,
        input: req.body as ChangeUserStatusRequest,
      });

      const parsed = userDtoSchema.parse(dto);

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsed);
    } catch (error) {
      next(error);
    }
  };

  list: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      if (!this.listUsersUseCase) {
        throw new Error('ListUsersUseCase no inyectado en UsersController');
      }

      const validated = getValidated(res);
      const query = (validated?.query ?? req.query) as ListUsersQuery;

      const response = await this.listUsersUseCase.execute({
        actorId,
        query,
      });

      const parsed = listUsersResponseSchema.parse(response);

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsed);
    } catch (error) {
      next(error);
    }
  };
}
