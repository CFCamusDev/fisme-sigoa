import {
  STAKEHOLDER_LIST_MEMBER_ACTIVITY_MAX_LENGTH as SHARED_ACTIVITY_MAX_LENGTH,
  STAKEHOLDER_LIST_MEMBER_REPRESENTATIVE_MAX_LENGTH as SHARED_REPRESENTATIVE_MAX_LENGTH,
  STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH as SHARED_STUDY_PLAN_MAX_LENGTH,
  STAKEHOLDER_LIST_TYPES as SHARED_TYPES,
  STAKEHOLDER_LIST_VERSION_MAX_LENGTH as SHARED_VERSION_MAX_LENGTH,
  STAKEHOLDER_LIST_YEAR_MAX as SHARED_YEAR_MAX,
  STAKEHOLDER_LIST_YEAR_MIN as SHARED_YEAR_MIN,
} from '@sigoa/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  STAKEHOLDER_LIST_MEMBER_ACTIVITY_MAX_LENGTH,
  STAKEHOLDER_LIST_MEMBER_REPRESENTATIVE_MAX_LENGTH,
  STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH,
  STAKEHOLDER_LIST_TYPES,
  STAKEHOLDER_LIST_VERSION_MAX_LENGTH,
  STAKEHOLDER_LIST_YEAR_MAX,
  STAKEHOLDER_LIST_YEAR_MIN,
} from '../domain/entities/stakeholder-list-enums.js';
import {
  DuplicateStakeholderListError,
  StakeholderListProgramNotConfiguredError,
} from '../domain/errors/index.js';
import type { StakeholderListProgramResolver } from '../domain/ports/stakeholder-list-program-resolver.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import { CreateStakeholderListUseCase } from './create-stakeholder-list.js';

const NOW = new Date('2026-11-16T12:00:00.000Z');

describe('CreateStakeholderListUseCase (HU-022, T-022-06, T-022-19)', () => {
  let stakeholderListRepository: MockProxy<StakeholderListRepository>;
  let programResolver: MockProxy<StakeholderListProgramResolver>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: CreateStakeholderListUseCase;

  beforeEach(() => {
    stakeholderListRepository = mock<StakeholderListRepository>();
    programResolver = mock<StakeholderListProgramResolver>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    programResolver.getCurrentProgramId.mockResolvedValue('prog-1');

    useCase = new CreateStakeholderListUseCase({
      stakeholderListRepository,
      programResolver,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'list-1',
      clock: () => NOW,
    });
  });

  it('creates a stakeholder list and audits it in the same transaction', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.1',
      type: 'EMPLOYER',
      year: 2027,
      studyPlanNumber: ' 2024-II ',
      version: ' v1.0 ',
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'constituyente.editar',
      scope: 'GLOBAL',
    });

    expect(result).toEqual({
      id: 'list-1',
      programId: 'prog-1',
      type: 'EMPLOYER',
      year: 2027,
      studyPlanNumber: '2024-II',
      version: 'v1.0',
      memberCount: 0,
      members: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });

    expect(stakeholderListRepository.save).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'CREATE',
      entity: 'StakeholderList',
      entityId: 'list-1',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: null,
      after: {
        programId: 'prog-1',
        type: 'EMPLOYER',
        year: 2027,
        studyPlanNumber: '2024-II',
        version: 'v1.0',
      },
    });
  });

  it('denies a user without constituyente.editar', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'user-2',
        type: 'EMPLOYER',
        year: 2027,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(stakeholderListRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails when there is no program', async () => {
    programResolver.getCurrentProgramId.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        type: 'EMPLOYER',
        year: 2027,
      }),
    ).rejects.toBeInstanceOf(StakeholderListProgramNotConfiguredError);

    expect(stakeholderListRepository.save).not.toHaveBeenCalled();
  });

  it('propagates DuplicateStakeholderListError without auditing', async () => {
    stakeholderListRepository.save.mockRejectedValueOnce(new DuplicateStakeholderListError());

    await expect(
      useCase.execute({
        actorId: 'user-1',
        type: 'EMPLOYER',
        year: 2027,
      }),
    ).rejects.toBeInstanceOf(DuplicateStakeholderListError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('keeps domain constants aligned with shared schemas', () => {
    expect(STAKEHOLDER_LIST_TYPES).toEqual(SHARED_TYPES);
    expect(STAKEHOLDER_LIST_YEAR_MIN).toBe(SHARED_YEAR_MIN);
    expect(STAKEHOLDER_LIST_YEAR_MAX).toBe(SHARED_YEAR_MAX);
    expect(STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH).toBe(SHARED_STUDY_PLAN_MAX_LENGTH);
    expect(STAKEHOLDER_LIST_VERSION_MAX_LENGTH).toBe(SHARED_VERSION_MAX_LENGTH);
    expect(STAKEHOLDER_LIST_MEMBER_ACTIVITY_MAX_LENGTH).toBe(SHARED_ACTIVITY_MAX_LENGTH);
    expect(STAKEHOLDER_LIST_MEMBER_REPRESENTATIVE_MAX_LENGTH).toBe(
      SHARED_REPRESENTATIVE_MAX_LENGTH,
    );
  });
});
