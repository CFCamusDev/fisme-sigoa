import type { Request, Response, NextFunction } from 'express';
import {
  loginResponseSchema,
  refreshResponseSchema,
  type LoginRequest,
  type RefreshRequest,
} from '@sigoa/shared';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { LoginUseCase } from '../../application/login.js';
import type { RefreshSessionUseCase } from '../../application/refresh-session.js';
import type { LogoutUseCase } from '../../application/logout.js';
import { resolveClientIp } from './client-ip.js';

export interface AuthControllerDependencies {
  loginUseCase: LoginUseCase;
  refreshSessionUseCase?: RefreshSessionUseCase;
  logoutUseCase?: LogoutUseCase;
}

export class AuthController {
  private readonly loginUseCase: LoginUseCase;
  private readonly refreshSessionUseCase?: RefreshSessionUseCase;
  private readonly logoutUseCase?: LogoutUseCase;

  constructor(deps: LoginUseCase | AuthControllerDependencies) {
    if ('execute' in deps) {
      this.loginUseCase = deps;
    } else {
      this.loginUseCase = deps.loginUseCase;
      this.refreshSessionUseCase = deps.refreshSessionUseCase;
      this.logoutUseCase = deps.logoutUseCase;
    }
  }

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { body } = getValidated<LoginRequest>(res);
      const ip = resolveClientIp(req);

      const result = await this.loginUseCase.execute({
        email: body.email,
        password: body.password,
        ip,
      });

      // Parseo estricto de la respuesta para garantizar cumplimiento de Ley 29733 (sin filtrar campos sensibles)
      const parsedResponse = loginResponseSchema.parse(result);

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.status(200).json(parsedResponse);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.refreshSessionUseCase) {
        throw new Error('RefreshSessionUseCase no configurado en AuthController');
      }

      const { body } = getValidated<RefreshRequest>(res);
      const ip = resolveClientIp(req);

      const result = await this.refreshSessionUseCase.execute({
        refreshToken: body.refreshToken,
        ip,
      });

      const parsedResponse = refreshResponseSchema.parse(result);

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.status(200).json(parsedResponse);
    } catch (error) {
      next(error);
    }
  };
}
