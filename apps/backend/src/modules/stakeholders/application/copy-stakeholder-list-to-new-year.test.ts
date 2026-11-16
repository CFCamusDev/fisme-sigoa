import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { StakeholderList } from '../domain/entities/stakeholder-list.js';
import { StakeholderListMember } from '../domain/entities/stakeholder-list-member.js';
import { Stakeholder } from '../domain/entities/stakeholder.js';
import {
  DuplicateStakeholderListError,
  InvalidStakeholderListDataError,
  StakeholderListNotFoundError,
} from '../domain/errors/index.js';
import type { StakeholderListMemberRepository } from '../domain/ports/stakeholder-list-member-repository.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderLookup } from '../domain/ports/stakeholder-lookup.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import { CopyStakeholderListToNewYearUseCase } from './copy-stakeholder-list-to-new-year.js';

const PAST = new Date('2025-11-16T12:00:00.000Z');
const NOW = new Date('2026-11-16T12:00:00.000Z');

describe('CopyStakeholderListToNewYearUseCase (HU-022, T-022-08, T-022-21)', () => {
  let stakeholderListRepository: MockProxy<StakeholderListRepository>;
  let stakeholderListMemberRepository: MockProxy<StakeholderListMemberRepository>;
  let stakeholderLookup: MockProxy<StakeholderLookup>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let nextId: number;
  let useCase: CopyStakeholderListToNewYearUseCase;

  beforeEach(() => {
    stakeholderListRepository = mock<StakeholderListRepository>();
    stakeholderListMemberRepository = mock<StakeholderListMemberRepository>();
    stakeholderLookup = mock<StakeholderLookup>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    nextId = 1;

    useCase = new CopyStakeholderListToNewYearUseCase({
      stakeholderListRepository,
      stakeholderListMemberRepository,
      stakeholderLookup,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => `gen-${nextId++}`,
      clock: () => NOW,
    });
  });

  it('copies the members of the previous year into a new list', async () => {
    const sourceList = StakeholderList.create({
      id: 'list-2026',
      programId: 'prog-1',
      type: 'EMPLOYER',
      year: 2026,
      studyPlanNumber: '2024-II',
      version: 'v1.0',
      actorId: 'user-1',
      now: PAST,
    });

    const employerOld = Stakeholder.register({
      id: 'stk-1',
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Tecnologia',
      position: 'Gerente',
      email: 'old@techamazonas.pe',
      mobile: '987654321',
      actorId: 'user-1',
      now: PAST,
    });

    const sourceMember = StakeholderListMember.create({
      id: 'mem-old-1',
      list: sourceList,
      stakeholder: employerOld,
      details: { representative: 'Carlos Mendoza' },
      actorId: 'user-1',
      now: PAST,
    });

    const employerRefreshed = Stakeholder.register({
      id: 'stk-1',
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Software',
      position: 'Director TI',
      email: 'nuevo@techamazonas.pe',
      mobile: '999888777',
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(sourceList);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([sourceMember]);
    stakeholderLookup.findByIds.mockResolvedValueOnce([employerRefreshed]);

    const result = await useCase.execute({
      sourceListId: 'list-2026',
      year: 2027,
      actorId: 'user-1',
      ip: '10.0.0.1',
    });

    expect(result.skipped).toEqual([]);
    expect(result.list).toMatchObject({
      id: 'gen-1',
      programId: 'prog-1',
      type: 'EMPLOYER',
      year: 2027,
      studyPlanNumber: '2024-II',
      version: 'v1.0',
      memberCount: 1,
    });
    expect(result.list.members).toHaveLength(1);
    expect(result.list.members?.[0]).toMatchObject({
      stakeholderId: 'stk-1',
      representative: 'Carlos Mendoza',
      sector: 'Software',
      position: 'Director TI',
      email: 'nuevo@techamazonas.pe',
      mobile: '999888777',
    });

    expect(stakeholderListRepository.save).toHaveBeenCalledTimes(1);
    expect(stakeholderListMemberRepository.addMany).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledTimes(2);
    expect(auditLogger.log.mock.calls[0]?.[0]).toMatchObject({
      action: 'CREATE',
      entity: 'StakeholderList',
      after: {
        copiedFromListId: 'list-2026',
        memberCount: 1,
      },
    });
  });

  it('denies a user without constituyente.editar', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError());

    await expect(
      useCase.execute({
        sourceListId: 'list-2026',
        year: 2027,
        actorId: 'user-2',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(stakeholderListRepository.findById).not.toHaveBeenCalled();
  });

  it('fails when the source list does not exist', async () => {
    stakeholderListRepository.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        sourceListId: 'missing-list',
        year: 2027,
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(StakeholderListNotFoundError);
  });

  it('rejects a target year not after the source year', async () => {
    stakeholderListRepository.findById.mockResolvedValueOnce(
      StakeholderList.create({
        id: 'list-2026',
        programId: 'prog-1',
        type: 'TEACHER',
        year: 2026,
        actorId: 'user-1',
        now: PAST,
      }),
    );

    await expect(
      useCase.execute({
        sourceListId: 'list-2026',
        year: 2026,
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(InvalidStakeholderListDataError);

    expect(stakeholderListRepository.save).not.toHaveBeenCalled();
  });

  it('skips voided stakeholders and reports them', async () => {
    const sourceList = StakeholderList.create({
      id: 'list-2026',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2026,
      actorId: 'user-1',
      now: PAST,
    });

    const activeTeacher = Stakeholder.register({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: 'Docente Activo',
      dni: '11111111',
      email: 'activo@untrm.edu.pe',
      mobile: '987654321',
      actorId: 'user-1',
      now: PAST,
    });
    const voidedTeacher = Stakeholder.register({
      id: 'stk-2',
      kind: 'PERSON',
      fullName: 'Docente Anulado',
      dni: '22222222',
      email: 'anulado@untrm.edu.pe',
      mobile: '987654322',
      actorId: 'user-1',
      now: PAST,
    });
    const incompleteTeacher = Stakeholder.register({
      id: 'stk-3',
      kind: 'PERSON',
      fullName: 'Docente Sin Celular',
      dni: '33333333',
      email: 'sin@untrm.edu.pe',
      mobile: '987654323',
      actorId: 'user-1',
      now: PAST,
    });

    const m1 = StakeholderListMember.create({
      id: 'mem-1',
      list: sourceList,
      stakeholder: activeTeacher,
      actorId: 'user-1',
      now: PAST,
    });
    const m2 = StakeholderListMember.create({
      id: 'mem-2',
      list: sourceList,
      stakeholder: voidedTeacher,
      actorId: 'user-1',
      now: PAST,
    });
    const m3 = StakeholderListMember.create({
      id: 'mem-3',
      list: sourceList,
      stakeholder: incompleteTeacher,
      actorId: 'user-1',
      now: PAST,
    });

    const voidedInMaster = voidedTeacher.void({
      reason: 'Dejo de laborar en la institucion',
      actorId: 'user-1',
      now: NOW,
    });
    const incompleteInMaster = incompleteTeacher.edit({ mobile: null, now: NOW });

    stakeholderListRepository.findById.mockResolvedValueOnce(sourceList);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([m1, m2, m3]);
    stakeholderLookup.findByIds.mockResolvedValueOnce([
      activeTeacher,
      voidedInMaster,
      incompleteInMaster,
    ]);

    const result = await useCase.execute({
      sourceListId: 'list-2026',
      year: 2027,
      actorId: 'user-1',
    });

    expect(result.list.memberCount).toBe(1);
    expect(result.skipped).toEqual([
      { stakeholderId: 'stk-2', fullName: 'Docente Anulado', reason: 'VOIDED' },
      { stakeholderId: 'stk-3', fullName: 'Docente Sin Celular', reason: 'INCOMPLETE' },
    ]);
  });

  it('does not leave a partial list when the target year already exists', async () => {
    const sourceList = StakeholderList.create({
      id: 'list-2026',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2026,
      actorId: 'user-1',
      now: PAST,
    });
    const teacher = Stakeholder.register({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: 'Docente Activo',
      dni: '11111111',
      email: 'activo@untrm.edu.pe',
      mobile: '987654321',
      actorId: 'user-1',
      now: PAST,
    });
    const member = StakeholderListMember.create({
      id: 'mem-1',
      list: sourceList,
      stakeholder: teacher,
      actorId: 'user-1',
      now: PAST,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(sourceList);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([member]);
    stakeholderLookup.findByIds.mockResolvedValueOnce([teacher]);
    stakeholderListRepository.save.mockRejectedValueOnce(new DuplicateStakeholderListError());

    await expect(
      useCase.execute({
        sourceListId: 'list-2026',
        year: 2027,
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(DuplicateStakeholderListError);

    expect(stakeholderListMemberRepository.addMany).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
