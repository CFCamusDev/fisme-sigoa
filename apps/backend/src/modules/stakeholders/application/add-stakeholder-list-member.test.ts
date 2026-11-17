import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { StakeholderList } from '../domain/entities/stakeholder-list.js';
import { Stakeholder } from '../domain/entities/stakeholder.js';
import {
  DuplicateListMemberError,
  IncompleteListMemberError,
  IneligibleListMemberError,
  StakeholderListNotFoundError,
  StakeholderNotFoundError,
} from '../domain/errors/index.js';
import type { StakeholderListMemberRepository } from '../domain/ports/stakeholder-list-member-repository.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import { AddStakeholderListMemberUseCase } from './add-stakeholder-list-member.js';

const NOW = new Date('2026-11-16T12:00:00.000Z');

describe('AddStakeholderListMemberUseCase (HU-022, T-022-07, T-022-20)', () => {
  let stakeholderListRepository: MockProxy<StakeholderListRepository>;
  let stakeholderListMemberRepository: MockProxy<StakeholderListMemberRepository>;
  let stakeholderRepository: MockProxy<StakeholderRepository>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: AddStakeholderListMemberUseCase;

  beforeEach(() => {
    stakeholderListRepository = mock<StakeholderListRepository>();
    stakeholderListMemberRepository = mock<StakeholderListMemberRepository>();
    stakeholderRepository = mock<StakeholderRepository>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());

    useCase = new AddStakeholderListMemberUseCase({
      stakeholderListRepository,
      stakeholderListMemberRepository,
      stakeholderRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'mem-1',
      clock: () => NOW,
    });
  });

  it('adds an institution to the employers list with the Annex 3 fields', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'EMPLOYER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    const employer = Stakeholder.register({
      id: 'stk-1',
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Tecnologia',
      position: 'Gerente General',
      email: 'contacto@techamazonas.pe',
      mobile: '987654321',
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    stakeholderRepository.findById.mockResolvedValueOnce(employer);

    const result = await useCase.execute({
      listId: 'list-1',
      stakeholderId: 'stk-1',
      representative: '  Carlos Mendoza  ',
      actorId: 'user-1',
      ip: '10.0.0.1',
    });

    expect(result).toEqual({
      id: 'mem-1',
      listId: 'list-1',
      stakeholderId: 'stk-1',
      fullName: 'Tech Amazonas SAC',
      institution: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Tecnologia',
      representative: 'Carlos Mendoza',
      activity: null,
      email: 'contacto@techamazonas.pe',
      mobile: '987654321',
      position: 'Gerente General',
      graduationYear: null,
      cycle: null,
      createdAt: NOW.toISOString(),
    });
    expect(stakeholderListMemberRepository.add).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
  });

  it('reports the missing fields of a graduate', async () => {
    const list = StakeholderList.create({
      id: 'list-2',
      programId: 'prog-1',
      type: 'GRADUATE',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    const graduate = Stakeholder.register({
      id: 'stk-2',
      kind: 'PERSON',
      fullName: 'Ana Torres',
      dni: '45678912',
      graduationYear: null,
      email: null,
      mobile: null,
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    stakeholderRepository.findById.mockResolvedValueOnce(graduate);

    let caught: unknown;
    try {
      await useCase.execute({
        listId: 'list-2',
        stakeholderId: 'stk-2',
        actorId: 'user-1',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IncompleteListMemberError);
    expect((caught as IncompleteListMemberError).missingFields).toEqual([
      'año de egreso',
      'correo',
      'celular',
    ]);
    expect(stakeholderListMemberRepository.add).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('denies a user without constituyente.editar', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError());

    await expect(
      useCase.execute({
        listId: 'list-1',
        stakeholderId: 'stk-1',
        actorId: 'user-2',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(stakeholderListRepository.findById).not.toHaveBeenCalled();
  });

  it('fails when the list does not exist', async () => {
    stakeholderListRepository.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        listId: 'missing-list',
        stakeholderId: 'stk-1',
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(StakeholderListNotFoundError);
  });

  it('fails when the stakeholder does not exist', async () => {
    stakeholderListRepository.findById.mockResolvedValueOnce(
      StakeholderList.create({
        id: 'list-1',
        programId: 'prog-1',
        type: 'TEACHER',
        year: 2027,
        actorId: 'user-1',
        now: NOW,
      }),
    );
    stakeholderRepository.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        listId: 'list-1',
        stakeholderId: 'missing-stk',
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(StakeholderNotFoundError);
  });

  it('rejects a voided stakeholder', async () => {
    stakeholderListRepository.findById.mockResolvedValueOnce(
      StakeholderList.create({
        id: 'list-1',
        programId: 'prog-1',
        type: 'TEACHER',
        year: 2027,
        actorId: 'user-1',
        now: NOW,
      }),
    );
    const voided = Stakeholder.register({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: 'Luis Paredes',
      dni: '12345678',
      email: 'luis@untrm.edu.pe',
      mobile: '987654321',
      actorId: 'user-1',
      now: NOW,
    }).void({
      reason: 'Registro duplicado en el sistema',
      actorId: 'user-1',
      now: NOW,
    });
    stakeholderRepository.findById.mockResolvedValueOnce(voided);

    await expect(
      useCase.execute({
        listId: 'list-1',
        stakeholderId: 'stk-1',
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(IneligibleListMemberError);
  });

  it('audits without email or mobile', async () => {
    stakeholderListRepository.findById.mockResolvedValueOnce(
      StakeholderList.create({
        id: 'list-1',
        programId: 'prog-1',
        type: 'TEACHER',
        year: 2027,
        actorId: 'user-1',
        now: NOW,
      }),
    );
    stakeholderRepository.findById.mockResolvedValueOnce(
      Stakeholder.register({
        id: 'stk-1',
        kind: 'PERSON',
        fullName: 'Luis Paredes',
        dni: '12345678',
        email: 'luis@untrm.edu.pe',
        mobile: '987654321',
        actorId: 'user-1',
        now: NOW,
      }),
    );

    await useCase.execute({
      listId: 'list-1',
      stakeholderId: 'stk-1',
      actorId: 'user-1',
    });

    const auditCall = auditLogger.log.mock.calls[0]?.[0];
    expect(auditCall?.after).toMatchObject({
      listId: 'list-1',
      stakeholderId: 'stk-1',
      hasEmail: true,
      hasMobile: true,
    });
    expect('email' in (auditCall?.after as Record<string, unknown>)).toBe(false);
    expect('mobile' in (auditCall?.after as Record<string, unknown>)).toBe(false);
  });

  it('propagates DuplicateListMemberError without auditing', async () => {
    stakeholderListRepository.findById.mockResolvedValueOnce(
      StakeholderList.create({
        id: 'list-1',
        programId: 'prog-1',
        type: 'TEACHER',
        year: 2027,
        actorId: 'user-1',
        now: NOW,
      }),
    );
    stakeholderRepository.findById.mockResolvedValueOnce(
      Stakeholder.register({
        id: 'stk-1',
        kind: 'PERSON',
        fullName: 'Luis Paredes',
        dni: '12345678',
        email: 'luis@untrm.edu.pe',
        mobile: '987654321',
        actorId: 'user-1',
        now: NOW,
      }),
    );
    stakeholderListMemberRepository.add.mockRejectedValueOnce(new DuplicateListMemberError());

    await expect(
      useCase.execute({
        listId: 'list-1',
        stakeholderId: 'stk-1',
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(DuplicateListMemberError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
