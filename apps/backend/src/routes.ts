import type { Express } from 'express';
import type { AuditLogger } from './shared/audit/audit-logger.js';
import type { UnitOfWork } from './shared/unit-of-work/unit-of-work.js';
import type { DbProvider } from './shared/prisma/prisma-unit-of-work.js';
import type { Env } from './config/env.js';
import type { Logger } from './shared/logger/logger.js';
import { createFileStorage } from './shared/storage/create-file-storage.js';
import type { FileStorage } from './shared/storage/file-storage.js';
import {
  createEmailSender,
  type EmailSender,
  type EmailSenderLogger,
} from './shared/email/index.js';
import { LogoUrlResolver } from './shared/branding/logo-url-resolver.js';
import { PuppeteerPdfGenerator, type PdfGenerator } from './shared/pdf/index.js';
import {
  createAuthModule,
  createAuthServices,
  EmailPasswordResetSender,
  type DetachedTaskRunner,
} from './modules/auth/index.js';
import {
  createAuthorizationServices,
  createMePermissionsModule,
  createPermissionsModule,
  createRolesModule,
  createUserAccessModule,
} from './modules/authorization/index.js';
import {
  createCatalogActivationSubscriber,
  createCatalogVersionsModule,
} from './modules/catalog/index.js';
import {
  createResolutionsModule,
  type ResolutionApprovedSubscriber,
} from './modules/resolutions/index.js';
import {
  createAnnexesModule,
  createGenerateAnnexPdfUseCase,
  createTemplatesModule,
} from './modules/templates/index.js';
import {
  createStakeholderListsModule,
  createStakeholdersModule,
} from './modules/stakeholders/index.js';
import { createStakeholderAnnexPdfGenerator } from './stakeholder-annex-pdf-adapter.js';
import {
  createProcessesModule,
  type ExecutionPreconditionProvider,
} from './modules/processes/index.js';
import { createQualityCommitteeModule } from './modules/quality-committee/index.js';
import { createSessionsModule } from './modules/sessions/index.js';
import { createUsersModule, EmailActivationSender } from './modules/users/index.js';
import {
  LoginAttemptsParameterProvider,
  ParameterResolver,
  PrismaParameterRepository,
  PrismaSemesterRepository,
  createParametersModule,
  createParameterValuesModule,
  createResponseScalesModule,
  createSemestersModule,
} from './modules/parameters/index.js';

export interface AppRoutesDependencies {
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  dbProvider: DbProvider;
  env: Env;
  emailSender?: EmailSender;
  fileStorage?: FileStorage;
  pdfGenerator?: PdfGenerator;
  /** Suscriptores de `ResolutionApproved` (HU-016 registra el suyo aquí, D6 del tramo 2 de HU-048). */
  resolutionApprovedSubscribers?: readonly ResolutionApprovedSubscriber[];
  processPreconditionProviders?: readonly ExecutionPreconditionProvider[];
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

  // LOGIN_INTENTOS (RF-011): `auth` consulta el parámetro vigente por el puerto de login.
  const maxFailedAttemptsProvider = new LoginAttemptsParameterProvider({
    resolver: new ParameterResolver({
      parameterReader: new PrismaParameterRepository(deps.dbProvider),
      semesterReader: new PrismaSemesterRepository(deps.dbProvider),
    }),
    fallbackMaxFailedAttempts: deps.env.AUTH_MAX_FAILED_ATTEMPTS,
    clock: deps.clock,
    logger: deps.logger,
  });

  app.use(
    '/auth',
    createAuthModule({
      ...deps,
      maxFailedAttemptsProvider,
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
    '/me',
    createMePermissionsModule({
      authenticate: authServices.authenticate,
      services: authorizationServices,
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
  app.use(
    '/program',
    createParametersModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      logger: deps.logger,
      clock: deps.clock,
    }),
  );
  app.use(
    '/parameters',
    createParameterValuesModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      logger: deps.logger,
      clock: deps.clock,
    }),
  );
  app.use(
    '/semesters',
    createSemestersModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      logger: deps.logger,
      clock: deps.clock,
    }),
  );
  app.use(
    '/response-scales',
    createResponseScalesModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      logger: deps.logger,
      clock: deps.clock,
    }),
  );
  app.use(
    '/catalog-versions',
    createCatalogVersionsModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      clock: deps.clock,
    }),
  );
  app.use(
    '/resolutions',
    createResolutionsModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      fileStorage: deps.fileStorage ?? createFileStorage(deps.env),
      resolutionApprovedSubscribers: [
        createCatalogActivationSubscriber({
          unitOfWork: deps.unitOfWork,
          auditLogger: deps.auditLogger,
          dbProvider: deps.dbProvider,
          permissionChecker: authorizationServices.authorizer,
          clock: deps.clock,
        }),
        ...(deps.resolutionApprovedSubscribers ?? []),
      ],
      logger: deps.logger,
      clock: deps.clock,
    }),
  );
  const pdfGenerator = deps.pdfGenerator ?? new PuppeteerPdfGenerator({ logger: deps.logger });
  const generateAnnexPdfUseCase = createGenerateAnnexPdfUseCase({
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    dbProvider: deps.dbProvider,
    permissionChecker: authorizationServices.authorizer,
    pdfGenerator,
    clock: deps.clock,
  });
  const stakeholderAnnexPdfGenerator = createStakeholderAnnexPdfGenerator(generateAnnexPdfUseCase);
  app.use(
    '/templates',
    createTemplatesModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      pdfGenerator,
      clock: deps.clock,
    }),
  );
  app.use(
    '/annexes',
    createAnnexesModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      pdfGenerator,
      generateAnnexPdfUseCase,
      clock: deps.clock,
    }),
  );
  app.use(
    '/stakeholders',
    createStakeholdersModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      clock: deps.clock,
    }),
  );
  app.use(
    '/stakeholder-lists',
    createStakeholderListsModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      annexPdfGenerator: stakeholderAnnexPdfGenerator,
      clock: deps.clock,
    }),
  );
  const processesModule = createProcessesModule({
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    dbProvider: deps.dbProvider,
    authenticate: authServices.authenticate,
    requirePermission: authorizationServices.requirePermission,
    permissionChecker: authorizationServices.authorizer,
    preconditionProviders: deps.processPreconditionProviders,
    clock: deps.clock,
  });
  app.use('/process-executions', processesModule.processExecutions);
  app.use('/process-executions', processesModule.executionSchedule);
  app.use('/process-executions', processesModule.executionTransitions);
  app.use('/schedule-activities', processesModule.scheduleActivities);
  const sessionsModule = createSessionsModule({
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    dbProvider: deps.dbProvider,
    authenticate: authServices.authenticate,
    requirePermission: authorizationServices.requirePermission,
    permissionChecker: authorizationServices.authorizer,
    clock: deps.clock,
  });
  app.use('/sessions', sessionsModule.sessions);
  app.use('/process-executions', sessionsModule.executionSessions);
  app.use(
    '/quality-committees',
    createQualityCommitteeModule({
      unitOfWork: deps.unitOfWork,
      auditLogger: deps.auditLogger,
      dbProvider: deps.dbProvider,
      authenticate: authServices.authenticate,
      requirePermission: authorizationServices.requirePermission,
      permissionChecker: authorizationServices.authorizer,
      clock: deps.clock,
    }),
  );
}
