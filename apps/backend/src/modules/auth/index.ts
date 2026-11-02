import type { Router } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { Env } from '../../config/env.js';
import { createRateLimiter } from '../../shared/middleware/rate-limit.js';
import { createAuthRouter } from './infrastructure/http/auth.routes.js';
import { PrismaUserRepository } from './infrastructure/prisma/prisma-user-repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma/prisma-refresh-token-repository.js';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher.js';
import { JoseAccessTokenSigner } from './infrastructure/security/jose-access-token-signer.js';
import { JoseAccessTokenVerifier } from './infrastructure/security/jose-access-token-verifier.js';
import { RandomRefreshTokenGenerator } from './infrastructure/security/random-refresh-token-generator.js';
import { LoginPolicy } from './domain/value-objects/login-policy.js';
import { LoginUseCase } from './application/login.js';
import { RefreshSessionUseCase } from './application/refresh-session.js';
import { createAuthenticate } from './infrastructure/http/authenticate.js';

export interface AuthModuleDependencies {
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  dbProvider?: DbProvider;
  env?: Env;
  clock?: () => Date;
}

export function createAuthModule(deps: AuthModuleDependencies): Router {
  if (!deps.env || !deps.dbProvider) {
    return createAuthRouter();
  }

  const userRepository = new PrismaUserRepository(deps.dbProvider);
  const refreshTokenRepository = new PrismaRefreshTokenRepository(deps.dbProvider);
  const passwordHasher = new Argon2PasswordHasher();
  const accessTokenSigner = new JoseAccessTokenSigner(
    deps.env.AUTH_JWT_SECRET,
    deps.env.AUTH_ACCESS_TTL_SECONDS,
  );
  const accessTokenVerifier = new JoseAccessTokenVerifier(deps.env.AUTH_JWT_SECRET);
  const _authenticate = createAuthenticate({
    verifier: accessTokenVerifier,
    userRepository,
    clock: deps.clock,
  });
  const refreshTokenGenerator = new RandomRefreshTokenGenerator(deps.env.AUTH_REFRESH_TTL_DAYS);
  const loginPolicy = new LoginPolicy({
    maxFailedAttempts: deps.env.AUTH_MAX_FAILED_ATTEMPTS,
    lockoutMinutes: deps.env.AUTH_LOCKOUT_MINUTES,
  });

  const loginUseCase = new LoginUseCase({
    userRepository,
    refreshTokenRepository,
    passwordHasher,
    accessTokenSigner,
    refreshTokenGenerator,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    loginPolicy,
    clock: deps.clock,
  });

  const refreshSessionUseCase = new RefreshSessionUseCase({
    refreshTokenRepository,
    userRepository,
    refreshTokenGenerator,
    accessTokenSigner,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const loginRateLimiter = createRateLimiter('login', deps.env);
  const sessionRateLimiter = createRateLimiter('session', deps.env);

  return createAuthRouter({
    loginUseCase,
    refreshSessionUseCase,
    rateLimiter: loginRateLimiter,
    sessionRateLimiter,
  });
}

export * from './domain/entities/user.js';
export * from './domain/entities/refresh-token.js';
export * from './domain/value-objects/login-policy.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/login.types.js';
export * from './application/login.js';
export * from './application/auth-user.js';
export * from './application/refresh-token-audit.js';
export * from './application/refresh-session.types.js';
export * from './application/refresh-session.js';
export * from './application/logout.types.js';
export * from './application/logout.js';
export * from './infrastructure/security/argon2-password-hasher.js';
export * from './infrastructure/security/jose-access-token-signer.js';
export * from './infrastructure/security/jose-access-token-verifier.js';
export * from './infrastructure/security/random-refresh-token-generator.js';
export * from './infrastructure/http/auth.controller.js';
export * from './infrastructure/http/auth.routes.js';
export * from './infrastructure/http/authenticate.js';
export * from './infrastructure/prisma/prisma-user-repository.js';
export * from './infrastructure/prisma/prisma-refresh-token-repository.js';
