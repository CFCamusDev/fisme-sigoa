import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Stakeholder } from '../domain/entities/stakeholder.js';
import {
  InvalidStakeholderDataError,
  InvalidStakeholderTransitionError,
  StakeholderNotFoundError,
} from '../domain/errors/index.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import { VoidStakeholderUseCase } from './void-stakeholder.js';

const CREATED_AT = new Date('2026-11-16T10:00:00.000Z');
const VOIDED_AT = new Date('2026-11-16T12:30:00.000Z');

function makeActivePerson(): Stakeholder {
  return Stakeholder.register({
    id: 'stk-1',
    kind: 'PERSON',
    fullName: 'Ana Lucia Torres',
    dni: '45678912',
    email: 'ana@example.com',
    mobile: '987654321',
    actorId: 'user-1',
    now: CREATED_AT,
  });
}

describe('VoidStakeholderUseCase (HU-021, T-021-08, T-021-22)', () => {
  let stakeholderRepository: MockProxy<StakeholderRepository>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: VoidStakeholderUseCase;

  beforeEach(() => {
    stakeholderRepository = mock<StakeholderRepository>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    stakeholderRepository.findById.mockResolvedValue(makeActivePerson());
    stakeholderRepository.saveChanges.mockResolvedValue(true);
    useCase = new VoidStakeholderUseCase({
      stakeholderRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => VOIDED_AT,
    });
  });

  it('voids with a reason and never deletes', async () => {
    const result = await useCase.execute({
      id: 'stk-1',
      actorId: 'user-2',
      ip: '10.0.0.2',
      reason: '  Constituyente duplicado en registro previo  ',
    });

    expect(result.status).toBe('VOIDED');
    expect(result.voidReason).toBe('Constituyente duplicado en registro previo');
    expect(result.voidedAt).toBe(VOIDED_AT.toISOString());
    expect(result.voidedBy).toBe('user-2');
    expect(result.updatedAt).toBe(VOIDED_AT.toISOString());

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
      action: 'VOID',
      entity: 'Stakeholder',
      entityId: 'stk-1',
      actor: 'user-2',
      ip: '10.0.0.2',
      before: makeActivePerson().snapshot(),
      after: {
        kind: 'PERSON',
        fullName: 'Ana Lucia Torres',
        dni: '45678912',
        ruc: null,
        hasEmail: true,
        hasMobile: true,
        position: null,
        institution: null,
        sector: null,
        graduationYear: null,
        cycle: null,
        status: 'VOIDED',
      },
    });
  });

  it('denies the action without the permission and writes nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({
        id: 'stk-1',
        actorId: 'user-2',
        reason: 'Motivo valido para anular constituyente',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(stakeholderRepository.findById).not.toHaveBeenCalled();
    expect(stakeholderRepository.saveChanges).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown stakeholder', async () => {
    stakeholderRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        id: 'missing',
        actorId: 'user-2',
        reason: 'Motivo valido para anular constituyente',
      }),
    ).rejects.toBeInstanceOf(StakeholderNotFoundError);

    expect(stakeholderRepository.saveChanges).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects voiding an already voided stakeholder', async () => {
    stakeholderRepository.findById.mockResolvedValue(
      makeActivePerson().void({
        reason: 'Ya fue anulado anteriormente por error',
        actorId: 'user-1',
        now: CREATED_AT,
      }),
    );

    await expect(
      useCase.execute({
        id: 'stk-1',
        actorId: 'user-2',
        reason: 'Segundo intento de anulacion valido',
      }),
    ).rejects.toBeInstanceOf(InvalidStakeholderTransitionError);

    expect(stakeholderRepository.saveChanges).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a void reason shorter than the minimum', async () => {
    await expect(
      useCase.execute({
        id: 'stk-1',
        actorId: 'user-2',
        reason: 'Corto',
      }),
    ).rejects.toBeInstanceOf(InvalidStakeholderDataError);

    await expect(
      useCase.execute({
        id: 'stk-1',
        actorId: 'user-2',
        reason: 'x'.repeat(501),
      }),
    ).rejects.toBeInstanceOf(InvalidStakeholderDataError);

    expect(stakeholderRepository.saveChanges).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('answers 409 and writes no audit when the stakeholder is voided between read and write', async () => {
    stakeholderRepository.saveChanges.mockResolvedValue(false);

    await expect(
      useCase.execute({
        id: 'stk-1',
        actorId: 'user-2',
        reason: 'Motivo valido para anular constituyente',
      }),
    ).rejects.toBeInstanceOf(InvalidStakeholderTransitionError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rolls back when the audit fails', async () => {
    auditLogger.log.mockRejectedValue(new Error('audit failure'));

    await expect(
      useCase.execute({
        id: 'stk-1',
        actorId: 'user-2',
        reason: 'Motivo valido para anular constituyente',
      }),
    ).rejects.toThrow('audit failure');
  });
});
