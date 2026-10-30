import { Router, type RequestHandler } from 'express';
import { loginRequestSchema } from '@sigoa/shared';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import { AuthController } from './auth.controller.js';
import type { LoginUseCase } from '../../application/login.js';

export interface AuthRouterDependencies {
  loginUseCase: LoginUseCase;
  rateLimiter?: RequestHandler;
}

export function createAuthRouter(deps?: AuthRouterDependencies): Router {
  const router = Router();
  if (!deps) {
    return router;
  }

  const controller = new AuthController(deps.loginUseCase);

  const middlewares: RequestHandler[] = [];
  if (deps.rateLimiter) {
    middlewares.push(deps.rateLimiter);
  }
  middlewares.push(validateRequest({ body: loginRequestSchema }));
  middlewares.push(controller.login);

  router.post('/login', ...middlewares);

  return router;
}
