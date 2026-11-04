import { Router, type RequestHandler } from 'express';
import { loginRequestSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import { AuthController } from './auth.controller.js';
import type { RefreshCookieSettings } from './refresh-cookie.js';
import type { LoginUseCase } from '../../application/login.js';
import type { RefreshSessionUseCase } from '../../application/refresh-session.js';
import type { LogoutUseCase } from '../../application/logout.js';

export interface AuthRouterDependencies {
  loginUseCase: LoginUseCase;
  refreshSessionUseCase?: RefreshSessionUseCase;
  logoutUseCase?: LogoutUseCase;
  rateLimiter?: RequestHandler;
  sessionRateLimiter?: RequestHandler;
  authenticate?: RequestHandler;
  cookieSettings?: RefreshCookieSettings;
  requireAllowedOrigin?: RequestHandler;
}

export function createAuthRouter(deps?: AuthRouterDependencies): Router {
  const router = Router();
  if (!deps) {
    return router;
  }

  const controller = new AuthController(deps);

  // POST /login
  const loginMiddlewares: RequestHandler[] = [];
  if (deps.rateLimiter) {
    loginMiddlewares.push(deps.rateLimiter);
  }
  if (deps.requireAllowedOrigin) {
    loginMiddlewares.push(deps.requireAllowedOrigin);
  }
  loginMiddlewares.push(validateRequest({ body: loginRequestSchema }));
  loginMiddlewares.push(controller.login);
  router.post('/login', ...loginMiddlewares);

  // POST /refresh (HU-002, T-002-06, RF-002, RS-016, RNF-007)
  if (deps.refreshSessionUseCase) {
    const refreshMiddlewares: RequestHandler[] = [];
    const refreshLimiter = deps.sessionRateLimiter ?? deps.rateLimiter;
    if (refreshLimiter) {
      refreshMiddlewares.push(refreshLimiter);
    }
    if (deps.requireAllowedOrigin) {
      refreshMiddlewares.push(deps.requireAllowedOrigin);
    }
    refreshMiddlewares.push(controller.refresh);
    router.post('/refresh', ...refreshMiddlewares);
  }

  // POST /logout (HU-002, T-002-07, RF-002, RS-016, RNF-007, RNF-009)
  if (deps.logoutUseCase) {
    const logoutMiddlewares: RequestHandler[] = [];
    const logoutLimiter = deps.sessionRateLimiter ?? deps.rateLimiter;
    if (logoutLimiter) {
      logoutMiddlewares.push(logoutLimiter);
    }
    if (deps.requireAllowedOrigin) {
      logoutMiddlewares.push(deps.requireAllowedOrigin);
    }
    if (deps.authenticate) {
      logoutMiddlewares.push(deps.authenticate);
    }
    logoutMiddlewares.push(controller.logout);
    router.post('/logout', ...logoutMiddlewares);
  }

  return router;
}
