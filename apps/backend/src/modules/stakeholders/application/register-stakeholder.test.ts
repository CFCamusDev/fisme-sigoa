import {
  STAKEHOLDER_DNI_PATTERN as SHARED_DNI_PATTERN,
  STAKEHOLDER_FULL_NAME_MAX_LENGTH as SHARED_FULL_NAME_MAX_LENGTH,
  STAKEHOLDER_KINDS as SHARED_KINDS,
  STAKEHOLDER_RUC_PATTERN as SHARED_RUC_PATTERN,
  STAKEHOLDER_STATUSES as SHARED_STATUSES,
} from '@sigoa/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  STAKEHOLDER_DNI_PATTERN,
  STAKEHOLDER_FULL_NAME_MAX_LENGTH,
  STAKEHOLDER_KINDS,
  STAKEHOLDER_RUC_PATTERN,
  STAKEHOLDER_STATUSES,
} from '../domain/entities/stakeholder-enums.js';
import { DuplicateStakeholderError, InvalidStakeholderDataError } from '../domain/errors/index.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import { RegisterStakeholderUseCase } from './register-stakeholder.js';

const NOW = new Date('2026-11-16T12:00:00.000Z');

const personCommand = {
  actorId: 'user-1',
  ip: '10.0.0.1',
  kind: 'PERSON',
  fullName: 'Ana Lucia Torres',
  dni: '45678912',
  email: 'Ana.Torres@Example.com',
  mobile: '987654321',
  position: 'Egresada',
  institution: 'UNTRM',
  sector: 'Educacion',
  graduationYear: 2022,
  cycle: null,
} as const;

describe('RegisterStakeholderUseCase (HU-021, T-021-06, T-021-20)', () => {
  let stakeholderRepository: MockProxy<StakeholderRepository>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: RegisterStakeholderUseCase;

  beforeEach(() => {
    stakeholderRepository = mock<StakeholderRepository>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    useCase = new RegisterStakeholderUseCase({
      stakeholderRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'stk-1',
      clock: () => NOW,
    });
  });

  it('registers a person with a DNI and audits it', async () => {
    const result = await useCase.execute(personCommand);

    expect(result).toEqual({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: 'Ana Lucia Torres',
      dni: '45678912',
      ruc: null,
      email: 'ana.torres@example.com',
      mobile: '987654321',
      position: 'Egresada',
      institution: 'UNTRM',
      sector: 'Educacion',
      graduationYear: 2022,
      cycle: null,
      status: 'ACTIVE',
      voidReason: null,
      voidedAt: null,
      voidedBy: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'constituyente.editar',
      scope: 'GLOBAL',
    });
    expect(stakeholderRepository.save).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'CREATE',
      entity: 'Stakeholder',
      entityId: 'stk-1',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: null,
      after: {
        kind: 'PERSON',
        fullName: 'Ana Lucia Torres',
        dni: '45678912',
        ruc: null,
        hasEmail: true,
        hasMobile: true,
        position: 'Egresada',
        institution: 'UNTRM',
        sector: 'Educacion',
        graduationYear: 2022,
        cycle: null,
        status: 'ACTIVE',
      },
    });
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
  });

  it('registers an institution with a RUC', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      ip: null,
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      email: null,
      mobile: null,
      position: null,
      sector: 'Tecnologia',
    });

    expect(result.kind).toBe('INSTITUTION');
    expect(result.ruc).toBe('20123456789');
    expect(result.dni).toBeNull();
    expect(result.status).toBe('ACTIVE');
  });

  it('denies the registration without the permission and writes nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute(personCommand)).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(stakeholderRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('propagates a duplicate and does not audit', async () => {
    stakeholderRepository.save.mockRejectedValue(new DuplicateStakeholderError());

    await expect(useCase.execute(personCommand)).rejects.toBeInstanceOf(DuplicateStakeholderError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rolls back when the audit fails', async () => {
    auditLogger.log.mockRejectedValue(new Error('audit failure'));

    await expect(useCase.execute(personCommand)).rejects.toThrow('audit failure');

    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid data before opening the transaction', async () => {
    await expect(
      useCase.execute({
        ...personCommand,
        dni: '123',
      }),
    ).rejects.toBeInstanceOf(InvalidStakeholderDataError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(stakeholderRepository.save).not.toHaveBeenCalled();
  });

  describe('contract parity between @sigoa/shared and the domain', () => {
    it('uses the same kinds, statuses and document patterns on both sides', () => {
      expect([...SHARED_KINDS]).toEqual([...STAKEHOLDER_KINDS]);
      expect([...SHARED_STATUSES]).toEqual([...STAKEHOLDER_STATUSES]);
      expect(SHARED_FULL_NAME_MAX_LENGTH).toBe(STAKEHOLDER_FULL_NAME_MAX_LENGTH);
      expect(SHARED_DNI_PATTERN.source).toBe(STAKEHOLDER_DNI_PATTERN.source);
      expect(SHARED_RUC_PATTERN.source).toBe(STAKEHOLDER_RUC_PATTERN.source);
    });
  });
});
