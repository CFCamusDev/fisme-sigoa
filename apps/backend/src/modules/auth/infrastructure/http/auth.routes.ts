import { Router, type RequestHandler } from 'express';
import {
  loginRequestSchema,
  activateAccountRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
} from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import { AuthController } from './auth.controller.js';
import type { RefreshCookieSettings } from './refresh-cookie.js';
import type { LoginUseCase } from '../../application/login.js';
import type { RefreshSessionUseCase } from '../../application/refresh-session.js';
import type { LogoutUseCase } from '../../application/logout.js';
import type { ActivateAccountUseCase } from '../../application/activate-account.js';
import type { RequestPasswordRecoveryUseCase } from '../../application/request-password-recovery.js';
import type { ResetPasswordUseCase } from '../../application/reset-password.js';

export interface AuthRouterDependencies {
  loginUseCase: LoginUseCase;
  refreshSessionUseCase?: RefreshSessionUseCase;
  logoutUseCase?: LogoutUseCase;
  activateAccountUseCase?: ActivateAccountUseCase;
  requestPasswordRecoveryUseCase?: RequestPasswordRecoveryUseCase;
  resetPasswordUseCase?: ResetPasswordUseCase;
  rateLimiter?: RequestHandler;
  sessionRateLimiter?: RequestHandler;
  publicRateLimiter?: RequestHandler;
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

  // POST /activate (HU-004, T-004-07, RF-004, RS-002, RNF-007)
  if (deps.activateAccountUseCase) {
    const activateMiddlewares: RequestHandler[] = [];
    const activateLimiter = deps.publicRateLimiter ?? deps.rateLimiter;
    if (activateLimiter) {
      activateMiddlewares.push(activateLimiter);
    }
    activateMiddlewares.push(validateRequest({ body: activateAccountRequestSchema }));
    activateMiddlewares.push(controller.activateAccount);
    router.post('/activate', ...activateMiddlewares);
  }

  // POST /forgot-password (HU-005, T-005-06, RF-005, RS-002, RNF-007, RNF-008)
  if (deps.requestPasswordRecoveryUseCase) {
    const forgotMiddlewares: RequestHandler[] = [];
    const forgotLimiter = deps.publicRateLimiter ?? deps.rateLimiter;
    if (forgotLimiter) {
      forgotMiddlewares.push(forgotLimiter);
    }
    forgotMiddlewares.push(validateRequest({ body: forgotPasswordRequestSchema }));
    forgotMiddlewares.push(controller.forgotPassword);
    router.post('/forgot-password', ...forgotMiddlewares);
  }

  // POST /reset-password (HU-005, T-005-07, RF-005, RS-002, RNF-007, RNF-008)
  if (deps.resetPasswordUseCase) {
    const resetMiddlewares: RequestHandler[] = [];
    const resetLimiter = deps.publicRateLimiter ?? deps.rateLimiter;
    if (resetLimiter) {
      resetMiddlewares.push(resetLimiter);
    }
    resetMiddlewares.push(validateRequest({ body: resetPasswordRequestSchema }));
    resetMiddlewares.push(controller.resetPassword);
    router.post('/reset-password', ...resetMiddlewares);
  }

  return router;
}
