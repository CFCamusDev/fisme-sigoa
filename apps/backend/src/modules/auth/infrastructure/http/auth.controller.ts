import type { Request, Response, NextFunction } from 'express';
import {
  loginResponseSchema,
  refreshResponseSchema,
  activateAccountResponseSchema,
  type LoginRequest,
  type ActivateAccountRequest,
} from '@sigoa/shared';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import { InvalidRefreshTokenError } from '../../domain/errors/index.js';
import type { LoginUseCase } from '../../application/login.js';
import type { RefreshSessionUseCase } from '../../application/refresh-session.js';
import type { LogoutUseCase } from '../../application/logout.js';
import type { ActivateAccountUseCase } from '../../application/activate-account.js';
import { resolveClientIp } from './client-ip.js';
import { getAuthenticatedPrincipal } from './authenticate.js';
import {
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
  type RefreshCookieSettings,
} from './refresh-cookie.js';

export interface AuthControllerDependencies {
  loginUseCase: LoginUseCase;
  refreshSessionUseCase?: RefreshSessionUseCase;
  logoutUseCase?: LogoutUseCase;
  activateAccountUseCase?: ActivateAccountUseCase;
  cookieSettings?: RefreshCookieSettings;
}

export class AuthController {
  private readonly loginUseCase: LoginUseCase;
  private readonly refreshSessionUseCase?: RefreshSessionUseCase;
  private readonly logoutUseCase?: LogoutUseCase;
  private readonly activateAccountUseCase?: ActivateAccountUseCase;
  private readonly cookieSettings: RefreshCookieSettings;

  constructor(deps: LoginUseCase | AuthControllerDependencies) {
    if ('execute' in deps) {
      this.loginUseCase = deps;
      this.cookieSettings = { sameSite: 'strict', isProduction: false };
    } else {
      this.loginUseCase = deps.loginUseCase;
      this.refreshSessionUseCase = deps.refreshSessionUseCase;
      this.logoutUseCase = deps.logoutUseCase;
      this.activateAccountUseCase = deps.activateAccountUseCase;
      this.cookieSettings = deps.cookieSettings ?? { sameSite: 'strict', isProduction: false };
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

      setRefreshCookie(
        res,
        result.refreshToken,
        new Date(result.refreshTokenExpiresAt),
        this.cookieSettings,
      );

      const { refreshToken: _ignored, ...publicPayload } = result;
      // Parseo estricto de la respuesta para garantizar cumplimiento de Ley 29733 (sin filtrar campos sensibles)
      const parsedResponse = loginResponseSchema.parse(publicPayload);

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

      const refreshToken = readRefreshCookie(req);
      if (!refreshToken) {
        throw new InvalidRefreshTokenError();
      }

      const ip = resolveClientIp(req);

      try {
        const result = await this.refreshSessionUseCase.execute({
          refreshToken,
          ip,
        });

        setRefreshCookie(
          res,
          result.refreshToken,
          new Date(result.refreshTokenExpiresAt),
          this.cookieSettings,
        );

        const { refreshToken: _ignored, ...publicPayload } = result;
        const parsedResponse = refreshResponseSchema.parse(publicPayload);

        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Pragma', 'no-cache');
        res.status(200).json(parsedResponse);
      } catch (error) {
        if (error instanceof InvalidRefreshTokenError) {
          clearRefreshCookie(res, this.cookieSettings);
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.logoutUseCase) {
        throw new Error('LogoutUseCase no configurado en AuthController');
      }

      const principal = getAuthenticatedPrincipal(res);
      const refreshToken = readRefreshCookie(req);
      const ip = resolveClientIp(req);

      if (refreshToken) {
        await this.logoutUseCase.execute({
          refreshToken,
          userId: principal.userId,
          ip,
        });
      }

      clearRefreshCookie(res, this.cookieSettings);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };

  activateAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.activateAccountUseCase) {
        throw new Error('ActivateAccountUseCase no configurado en AuthController');
      }

      const { body } = getValidated<ActivateAccountRequest>(res);
      const ip = resolveClientIp(req);

      const result = await this.activateAccountUseCase.execute({
        token: body.token,
        password: body.password,
        ip,
      });

      const parsedResponse = activateAccountResponseSchema.parse(result);

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.status(200).json(parsedResponse);
    } catch (error) {
      next(error);
    }
  };
}
