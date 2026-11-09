import type { Express } from 'express';
import type { AuditLogger } from './shared/audit/audit-logger.js';
import type { UnitOfWork } from './shared/unit-of-work/unit-of-work.js';
import type { DbProvider } from './shared/prisma/prisma-unit-of-work.js';
import type { Env } from './config/env.js';
import type { Logger } from './shared/logger/logger.js';
import {
  createEmailSender,
  type EmailSender,
  type EmailSenderLogger,
} from './shared/email/index.js';
import { LogoUrlResolver } from './shared/branding/logo-url-resolver.js';
import {
  createAuthModule,
  createAuthServices,
  EmailPasswordResetSender,
  type DetachedTaskRunner,
} from './modules/auth/index.js';
import {
  createAuthorizationServices,
  createPermissionsModule,
  createRolesModule,
  createUserAccessModule,
} from './modules/authorization/index.js';
import { createUsersModule, EmailActivationSender } from './modules/users/index.js';

export interface AppRoutesDependencies {
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  dbProvider: DbProvider;
  env: Env;
  emailSender?: EmailSender;
  logger?: Logger;
  clock?: () => Date;
  detachedTaskRunner?: DetachedTaskRunner;
  permissionCache?: {
    ttlMs?: number;
    maxEntries?: number;
  };
}

export function setupAppRoutes(app: Express, deps: AppRoutesDependencies): void {
  const publicAppUrl = deps.env.APP_PUBLIC_URL ?? 'http://localhost:5173';
  if (deps.env.NODE_ENV === 'production' && !deps.env.APP_PUBLIC_URL) {
    throw new Error('APP_PUBLIC_URL es obligatorio en entorno de producción');
  }

  const authServices = createAuthServices({
    dbProvider: deps.dbProvider,
    env: deps.env,
    clock: deps.clock,
  });

  const authorizationServices = createAuthorizationServices({
    dbProvider: deps.dbProvider,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    logger: deps.logger,
    permissionCache: deps.permissionCache,
  });

  const emailSender =
    deps.emailSender ?? createEmailSender(deps.env, deps.logger as EmailSenderLogger | undefined);

  const logoUrlResolver = new LogoUrlResolver(publicAppUrl);

  const activationEmailSender = new EmailActivationSender({
    emailSender,
    logoUrlResolver,
    publicAppUrl,
  });

  const passwordResetEmailSender = new EmailPasswordResetSender({
    emailSender,
    logoUrlResolver,
    publicAppUrl,
  });

  app.use(
    '/auth',
    createAuthModule({
      ...deps,
      passwordResetEmailSender,
      detachedTaskRunner: deps.detachedTaskRunner,
    }),
  );
  app.use(
    '/roles',
    createRolesModule({
      authenticate: authServices.authenticate,
      services: authorizationServices,
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
    }),
  );
  app.use(
    '/permissions',
    createPermissionsModule({
      authenticate: authServices.authenticate,
      services: authorizationServices,
      dbProvider: deps.dbProvider,
    }),
  );
  app.use(
    '/users',
    createUsersModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      userRoleGateway: authorizationServices.userRoleGateway,
      activationTokenIssuer: authServices.activationTokenIssuer,
      activationEmailSender,
      logger: deps.logger,
      clock: deps.clock,
    }),
  );
  app.use(
    '/users',
    createUserAccessModule({
      authenticate: authServices.authenticate,
      services: authorizationServices,
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
    }),
  );
}
