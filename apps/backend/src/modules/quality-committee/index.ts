import { Router, type RequestHandler } from 'express';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import { ManageCommitteeMembersUseCase } from './application/manage-committee-members.js';
import { RegisterQualityCommitteeUseCase } from './application/register-quality-committee.js';
import type { CommitteePermissionChecker } from './domain/ports/committee-permission-checker.js';
import { QualityCommitteeController } from './infrastructure/http/quality-committee.controller.js';
import {
  createQualityCommitteeRouter,
  type QualityCommitteeRoutePermissionScope,
} from './infrastructure/http/quality-committee.routes.js';
import { PrismaCommitteeMemberRepository } from './infrastructure/prisma/prisma-committee-member-repository.js';
import { PrismaCommitteeProgramResolver } from './infrastructure/prisma/prisma-committee-program-resolver.js';
import { PrismaCommitteeUserReader } from './infrastructure/prisma/prisma-committee-user-reader.js';
import { PrismaQualityCommitteeRepository } from './infrastructure/prisma/prisma-quality-committee-repository.js';

export interface QualityCommitteeModuleDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dbProvider: DbProvider;
  readonly authenticate: RequestHandler;
  readonly requirePermission: (
    permission: string,
    scope?: QualityCommitteeRoutePermissionScope,
  ) => RequestHandler;
  readonly permissionChecker: CommitteePermissionChecker;
  readonly clock?: () => Date;
}

export function createQualityCommitteeModule(deps?: QualityCommitteeModuleDependencies): Router {
  if (!deps) {
    return Router();
  }

  const qualityCommitteeRepository = new PrismaQualityCommitteeRepository(deps.dbProvider);
  const committeeMemberRepository = new PrismaCommitteeMemberRepository(deps.dbProvider);
  const programResolver = new PrismaCommitteeProgramResolver(deps.dbProvider);
  const committeeUserReader = new PrismaCommitteeUserReader(deps.dbProvider);

  const registerQualityCommitteeUseCase = new RegisterQualityCommitteeUseCase({
    qualityCommitteeRepository,
    committeeMemberRepository,
    programResolver,
    committeeUserReader,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const manageCommitteeMembersUseCase = new ManageCommitteeMembersUseCase({
    qualityCommitteeRepository,
    committeeMemberRepository,
    committeeUserReader,
    permissionChecker: deps.permissionChecker,
    unitOfWork: deps.unitOfWork,
    auditLogger: deps.auditLogger,
    clock: deps.clock,
  });

  const controller = new QualityCommitteeController({
    registerQualityCommitteeUseCase,
    manageCommitteeMembersUseCase,
  });

  return createQualityCommitteeRouter({
    controller,
    authenticate: deps.authenticate,
    requirePermission: deps.requirePermission,
  });
}

export * from './domain/entities/committee-member-position.js';
export * from './domain/entities/committee-member.js';
export * from './domain/entities/quality-committee.js';
export * from './domain/policies/committee-composition.js';
export * from './domain/policies/committee-period.js';
export * from './domain/policies/president-alert.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/committee-dto.js';
export * from './application/register-quality-committee.js';
export * from './application/register-quality-committee.types.js';
export * from './application/manage-committee-members.js';
export * from './application/manage-committee-members.types.js';
export * from './application/get-current-quality-committee.js';
export * from './application/get-current-quality-committee.types.js';
export * from './infrastructure/http/quality-committee.controller.js';
export * from './infrastructure/http/quality-committee.routes.js';
