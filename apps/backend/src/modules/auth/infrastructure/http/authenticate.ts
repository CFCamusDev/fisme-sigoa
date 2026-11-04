import type { RequestHandler, Response } from 'express';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import { setRequestActor } from '../../../../shared/audit/request-context.js';
import type { AccessTokenVerifier } from '../../domain/ports/access-token-verifier.js';
import type { UserRepository } from '../../domain/ports/user-repository.js';

export interface AuthenticatedPrincipal {
  userId: string;
}

export interface CreateAuthenticateDependencies {
  verifier: AccessTokenVerifier;
  userRepository: UserRepository;
  clock?: () => Date;
}

export function createAuthenticate(deps: CreateAuthenticateDependencies): RequestHandler {
  const getNow = deps.clock ?? (() => new Date());

  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      next(new UnauthorizedError());
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      next(new UnauthorizedError());
      return;
    }

    const token = parts[1]?.trim();
    if (!token) {
      next(new UnauthorizedError());
      return;
    }

    try {
      const now = getNow();
      const payload = await deps.verifier.verify(token, now);

      const user = await deps.userRepository.findById(payload.userId);
      if (!user || user.status !== 'ACTIVE') {
        next(new UnauthorizedError());
        return;
      }

      const principal: AuthenticatedPrincipal = {
        userId: user.id,
      };

      res.locals['auth'] = principal;
      setRequestActor(user.id);

      next();
    } catch {
      next(new UnauthorizedError());
    }
  };
}

export function getAuthenticatedPrincipal(res: Response): AuthenticatedPrincipal {
  const auth = res.locals['auth'] as AuthenticatedPrincipal | undefined;
  if (!auth) {
    throw new UnauthorizedError();
  }
  return auth;
}
