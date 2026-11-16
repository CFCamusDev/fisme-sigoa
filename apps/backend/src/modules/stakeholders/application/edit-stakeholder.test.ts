import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Stakeholder } from '../domain/entities/stakeholder.js';
import {
  DuplicateStakeholderError,
  InvalidStakeholderDataError,
  InvalidStakeholderTransitionError,
  StakeholderNotFoundError,
} from '../domain/errors/index.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import { EditStakeholderUseCase } from './edit-stakeholder.js';

const CREATED_AT = new Date('2026-11-16T10:00:00.000Z');
const UPDATED_AT = new Date('2026-11-16T12:00:00.000Z');

function makeActivePerson(): Stakeholder {
  return Stakeholder.register({
    id: 'stk-1',
    kind: 'PERSON',
    fullName: 'Ana Lucia Torres',
    dni: '45678912',
    email: 'ana@example.com',
    mobile: '987654321',
    position: 'Egresada',
    institution: 'UNTRM',
    sector: 'Educacion',
    graduationYear: 2022,
    cycle: null,
    actorId: 'user-1',
    now: CREATED_AT,
  });
}

describe('EditStakeholderUseCase (HU-021, T-021-07, T-021-21)', () => {
  let stakeholderRepository: MockProxy<StakeholderRepository>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: EditStakeholderUseCase;

  beforeEach(() => {
    stakeholderRepository = mock<StakeholderRepository>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    stakeholderRepository.findById.mockResolvedValue(makeActivePerson());
    stakeholderRepository.saveChanges.mockResolvedValue(true);
    useCase = new EditStakeholderUseCase({
      stakeholderRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => UPDATED_AT,
    });
  });

  it('updates the data and audits before and after', async () => {
    const result = await useCase.execute({
      id: 'stk-1',
      actorId: 'user-2',
      ip: '10.0.0.2',
      fullName: 'Ana Torres Mendoza',
      position: 'Jefa de Sistemas',
      email: 'Ana.Nueva@Example.com',
    });

    expect(result).toEqual({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: 'Ana Torres Mendoza',
      dni: '45678912',
      ruc: null,
      email: 'ana.nueva@example.com',
      mobile: '987654321',
      position: 'Jefa de Sistemas',
      institution: 'UNTRM',
      sector: 'Educacion',
      graduationYear: 2022,
      cycle: null,
      status: 'ACTIVE',
      voidReason: null,
      voidedAt: null,
      voidedBy: null,
      createdAt: CREATED_AT.toISOString(),
      updatedAt: UPDATED_AT.toISOString(),
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-2',
      permission: 'constituyente.editar',
      scope: 'GLOBAL',
    });
    expect(stakeholderRepository.saveChanges).toHaveBeenCalledWith(
      expect.any(Stakeholder),
      'ACTIVE',
    );
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'UPDATE',
      entity: 'Stakeholder',
      entityId: 'stk-1',
      actor: 'user-2',
      ip: '10.0.0.2',
      before: makeActivePerson().snapshot(),
      after: {
        kind: 'PERSON',
        fullName: 'Ana Torres Mendoza',
        dni: '45678912',
        ruc: null,
        hasEmail: true,
        hasMobile: true,
        position: 'Jefa de Sistemas',
        institution: 'UNTRM',
        sector: 'Educacion',
        graduationYear: 2022,
        cycle: null,
        status: 'ACTIVE',
      },
    });
  });

  it('clears optional fields when null is passed', async () => {
    const result = await useCase.execute({
      id: 'stk-1',
      actorId: 'user-2',
      email: null,
      mobile: null,
    });

    expect(result.email).toBeNull();
    expect(result.mobile).toBeNull();
    expect(result.fullName).toBe('Ana Lucia Torres');
  });

  it('denies the action without the permission and writes nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({ id: 'stk-1', actorId: 'user-2', position: 'Otro' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(stakeholderRepository.findById).not.toHaveBeenCalled();
    expect(stakeholderRepository.saveChanges).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown stakeholder', async () => {
    stakeholderRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: 'missing', actorId: 'user-2', position: 'Otro' }),
    ).rejects.toBeInstanceOf(StakeholderNotFoundError);

    expect(stakeholderRepository.saveChanges).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects editing a voided stakeholder', async () => {
    stakeholderRepository.findById.mockResolvedValue(
      makeActivePerson().void({
        reason: 'Constituyente dado de baja por solicitud',
        actorId: 'user-1',
        now: CREATED_AT,
      }),
    );

    await expect(
      useCase.execute({ id: 'stk-1', actorId: 'user-2', position: 'Otro' }),
    ).rejects.toBeInstanceOf(InvalidStakeholderTransitionError);

    expect(stakeholderRepository.saveChanges).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('answers 409 and writes no audit when the stakeholder is voided between read and write', async () => {
    stakeholderRepository.saveChanges.mockResolvedValue(false);

    await expect(
      useCase.execute({ id: 'stk-1', actorId: 'user-2', position: 'Otro' }),
    ).rejects.toBeInstanceOf(InvalidStakeholderTransitionError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('propagates a duplicate document and writes no audit', async () => {
    stakeholderRepository.saveChanges.mockRejectedValue(new DuplicateStakeholderError());

    await expect(
      useCase.execute({ id: 'stk-1', actorId: 'user-2', dni: '87654321' }),
    ).rejects.toBeInstanceOf(DuplicateStakeholderError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects invalid domain changes without saving or auditing', async () => {
    await expect(
      useCase.execute({ id: 'stk-1', actorId: 'user-2', dni: null }),
    ).rejects.toBeInstanceOf(InvalidStakeholderDataError);

    expect(stakeholderRepository.saveChanges).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rolls back when the audit fails', async () => {
    auditLogger.log.mockRejectedValue(new Error('audit failure'));

    await expect(
      useCase.execute({ id: 'stk-1', actorId: 'user-2', position: 'Otro' }),
    ).rejects.toThrow('audit failure');
  });
});
