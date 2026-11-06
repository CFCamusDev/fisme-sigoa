import type { Router } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { Env } from '../../config/env.js';
import { createRateLimiter } from '../../shared/middleware/rate-limit.js';
import { createAuthRouter } from './infrastructure/http/auth.routes.js';
import { PrismaUserRepository } from './infrastructure/prisma/prisma-user-repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma/prisma-refresh-token-repository.js';
import { PrismaActivationTokenRepository } from './infrastructure/prisma/prisma-activation-token-repository.js';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher.js';
import { JoseAccessTokenSigner } from './infrastructure/security/jose-access-token-signer.js';
import { JoseAccessTokenVerifier } from './infrastructure/security/jose-access-token-verifier.js';
import { RandomRefreshTokenGenerator } from './infrastructure/security/random-refresh-token-generator.js';
import { RandomActivationTokenGenerator } from './infrastructure/security/random-activation-token-generator.js';
import { LoginPolicy } from './domain/value-objects/login-policy.js';
import { LoginUseCase } from './application/login.js';
import { RefreshSessionUseCase } from './application/refresh-session.js';
import { LogoutUseCase } from './application/logout.js';
import { ActivationTokenIssuerService } from './application/activation-token-issuer-service.js';
import { ActivateAccountUseCase } from './application/activate-account.js';
import { createAuthenticate } from './infrastructure/http/authenticate.js';
import { createRequireAllowedOrigin } from './infrastructure/http/require-allowed-origin.js';

export interface AuthModuleDependencies {
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  dbProvider?: DbProvider;
  env?: Env;
  clock?: () => Date;
}

export interface AuthServicesDependencies {
  dbProvider: DbProvider;
  env: Pick<
    Env,
    | 'AUTH_JWT_SECRET'
    | 'AUTH_ACCESS_TTL_SECONDS'
    | 'AUTH_REFRESH_TTL_DAYS'
    | 'AUTH_MAX_FAILED_ATTEMPTS'
    | 'AUTH_LOCKOUT_MINUTES'
  >;
  clock?: () => Date;
}

export interface AuthServices {
  readonly userRepository: PrismaUserRepository;
  readonly refreshTokenRepository: PrismaRefreshTokenRepository;
  readonly activationTokenRepository: PrismaActivationTokenRepository;
  readonly passwordHasher: Argon2PasswordHasher;
  readonly accessTokenSigner: JoseAccessTokenSigner;
  readonly accessTokenVerifier: JoseAccessTokenVerifier;
  readonly refreshTokenGenerator: RandomRefreshTokenGenerator;
  readonly activationTokenGenerator: RandomActivationTokenGenerator;
  readonly activationTokenIssuer: ActivationTokenIssuerService;
  readonly loginPolicy: LoginPolicy;
  readonly authenticate: ReturnType<typeof createAuthenticate>;
}

export function createAuthServices(deps: AuthServicesDependencies): AuthServices {
  const userRepository = new PrismaUserRepository(deps.dbProvider);
  const refreshTokenRepository = new PrismaRefreshTokenRepository(deps.dbProvider);
  const activationTokenRepository = new PrismaActivationTokenRepository(deps.dbProvider);
  const passwordHasher = new Argon2PasswordHasher();
  const accessTokenSigner = new JoseAccessTokenSigner(
    deps.env.AUTH_JWT_SECRET,
    deps.env.AUTH_ACCESS_TTL_SECONDS,
  );
  const accessTokenVerifier = new JoseAccessTokenVerifier(deps.env.AUTH_JWT_SECRET);
  const authenticate = createAuthenticate({
    verifier: accessTokenVerifier,
    userRepository,
    clock: deps.clock,
  });
  const refreshTokenGenerator = new RandomRefreshTokenGenerator(deps.env.AUTH_REFRESH_TTL_DAYS);
  const activationTokenGenerator = new RandomActivationTokenGenerator();
  const activationTokenIssuer = new ActivationTokenIssuerService(
    activationTokenRepository,
    activationTokenGenerator,
  );
  const loginPolicy = new LoginPolicy({
    maxFailedAttempts: deps.env.AUTH_MAX_FAILED_ATTEMPTS,
    lockoutMinutes: deps.env.AUTH_LOCKOUT_MINUTES,
  });

  return {
    userRepository,
    refreshTokenRepository,
    activationTokenRepository,
    passwordHasher,
    accessTokenSigner,
    accessTokenVerifier,
    refreshTokenGenerator,
    activationTokenGenerator,
    activationTokenIssuer,
    loginPolicy,
    authenticate,
  };
}

export function createAuthModule(deps: AuthModuleDependencies): Router {
  if (!deps.env || !deps.dbProvider) {
    return createAuthRouter();
  }

  const services = createAuthServices({
    dbProvider: deps.dbProvider,
    env: deps.env,
    clock: deps.clock,
  });

  const loginUseCase = new LoginUseCase({
    userRepository: services.userRepository,
    refreshTokenRepository: services.refreshTokenRepository,
    passwordHasher: services.passwordHasher,
    accessTokenSigner: services.accessTokenSigner,
    refreshTokenGenerator: services.refreshTokenGenerator,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    loginPolicy: services.loginPolicy,
    clock: deps.clock,
  });

  const refreshSessionUseCase = new RefreshSessionUseCase({
    refreshTokenRepository: services.refreshTokenRepository,
    userRepository: services.userRepository,
    refreshTokenGenerator: services.refreshTokenGenerator,
    accessTokenSigner: services.accessTokenSigner,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const logoutUseCase = new LogoutUseCase({
    refreshTokenRepository: services.refreshTokenRepository,
    refreshTokenGenerator: services.refreshTokenGenerator,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const activateAccountUseCase = new ActivateAccountUseCase({
    userRepository: services.userRepository,
    activationTokenRepository: services.activationTokenRepository,
    activationTokenGenerator: services.activationTokenGenerator,
    passwordHasher: services.passwordHasher,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const loginRateLimiter = createRateLimiter('login', deps.env);
  const sessionRateLimiter = createRateLimiter('session', deps.env);
  const publicRateLimiter = createRateLimiter('public', deps.env);

  const cookieSettings = {
    sameSite: deps.env.AUTH_COOKIE_SAMESITE,
    isProduction: deps.env.NODE_ENV === 'production',
  };
  const requireAllowedOrigin = createRequireAllowedOrigin(deps.env.CORS_ORIGIN);

  return createAuthRouter({
    loginUseCase,
    refreshSessionUseCase,
    logoutUseCase,
    activateAccountUseCase,
    rateLimiter: loginRateLimiter,
    sessionRateLimiter,
    publicRateLimiter,
    authenticate: services.authenticate,
    cookieSettings,
    requireAllowedOrigin,
  });
}

export * from './domain/entities/user.js';
export * from './domain/entities/refresh-token.js';
export * from './domain/entities/activation-token.js';
export * from './domain/value-objects/login-policy.js';
export * from './domain/value-objects/password-policy.js';
export * from './domain/value-objects/password-recovery-policy.js';
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
export * from './application/activation-token-issuer-service.js';
export * from './application/activate-account.types.js';
export * from './application/activate-account.js';
export * from './application/detached-task-runner.js';
export * from './application/request-password-recovery.types.js';
export * from './application/request-password-recovery.js';
export * from './infrastructure/security/argon2-password-hasher.js';
export * from './infrastructure/security/jose-access-token-signer.js';
export * from './infrastructure/security/jose-access-token-verifier.js';
export * from './infrastructure/security/random-refresh-token-generator.js';
export * from './infrastructure/security/random-activation-token-generator.js';
export * from './infrastructure/http/auth.controller.js';
export * from './infrastructure/http/auth.routes.js';
export * from './infrastructure/http/authenticate.js';
export * from './infrastructure/http/refresh-cookie.js';
export * from './infrastructure/http/require-allowed-origin.js';
export * from './infrastructure/prisma/prisma-user-repository.js';
export * from './infrastructure/prisma/prisma-refresh-token-repository.js';
export * from './infrastructure/prisma/prisma-activation-token-repository.js';
