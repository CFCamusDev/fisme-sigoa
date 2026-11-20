import { scheduleActivityDtoSchema } from '@sigoa/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ScheduleActivity } from '../domain/entities/schedule-activity.js';
import {
  InvalidScheduleDataError,
  InvalidScheduleTransitionError,
  ScheduleActivityNotFoundError,
  ScheduleExecutionClosedError,
} from '../domain/errors/index.js';
import type {
  ProcessPermissionChecker,
  ScheduleActivityRepository,
  ScheduleExecutionLocker,
} from '../domain/ports/index.js';
import { ChangeScheduleActivityStatusUseCase } from './change-schedule-activity-status.js';

const BASE_NOW = new Date('2027-03-01T10:00:00.000Z');
// 2027-03-16T03:00:00Z es 2027-03-15 22:00 en America/Lima
const ACTION_NOW = new Date('2027-03-16T03:00:00.000Z');

describe('ChangeScheduleActivityStatusUseCase (HU-028, T-028-07, T-028-19)', () => {
  let locker: MockProxy<ScheduleExecutionLocker>;
  let repository: MockProxy<ScheduleActivityRepository>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: ChangeScheduleActivityStatusUseCase;

  beforeEach(() => {
    locker = mock<ScheduleExecutionLocker>();
    repository = mock<ScheduleActivityRepository>();
    permissionChecker = mock<ProcessPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();

    unitOfWork.run.mockImplementation(async (work) => work());
    locker.lockById.mockResolvedValue({
      id: 'exec-1',
      status: 'IN_PROGRESS',
      type: 'P611',
    });

    useCase = new ChangeScheduleActivityStatusUseCase({
      scheduleExecutionLocker: locker,
      scheduleActivityRepository: repository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => ACTION_NOW,
    });
  });

  function makeActivity(status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'): ScheduleActivity {
    return ScheduleActivity.rehydrate({
      id: 'act-1',
      processExecutionId: 'exec-1',
      number: 1,
      activity: 'Elaborar cronograma',
      responsible: 'Presidente',
      goal: 'Anexo 1',
      indicator: '1 documento',
      startDate: '2027-03-01',
      endDate: '2027-03-20',
      status,
      actualEndDate: status === 'COMPLETED' ? '2027-03-10' : null,
      createdBy: 'user-1',
      updatedBy: null,
      createdAt: BASE_NOW,
      updatedAt: BASE_NOW,
    });
  }

  it('starts a pending activity', async () => {
    const pending = makeActivity('PENDING');
    repository.findById.mockResolvedValue(pending);
    repository.findByIdForUpdate.mockResolvedValue(pending);

    const result = await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.1',
      activityId: 'act-1',
      status: 'IN_PROGRESS',
    });

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.actualEndDate).toBeNull();
    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it('completes an in-progress activity and stores the given actual end date', async () => {
    const inProgress = makeActivity('IN_PROGRESS');
    repository.findById.mockResolvedValue(inProgress);
    repository.findByIdForUpdate.mockResolvedValue(inProgress);

    const result = await useCase.execute({
      actorId: 'user-1',
      activityId: 'act-1',
      status: 'COMPLETED',
      actualEndDate: '2027-03-12',
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.actualEndDate).toBe('2027-03-12');
    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it('defaults the actual end date to today in Lima', async () => {
    const inProgress = makeActivity('IN_PROGRESS');
    repository.findById.mockResolvedValue(inProgress);
    repository.findByIdForUpdate.mockResolvedValue(inProgress);

    const result = await useCase.execute({
      actorId: 'user-1',
      activityId: 'act-1',
      status: 'COMPLETED',
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.actualEndDate).toBe('2027-03-15');
  });

  it('rejects completing a pending activity', async () => {
    const pending = makeActivity('PENDING');
    repository.findById.mockResolvedValue(pending);
    repository.findByIdForUpdate.mockResolvedValue(pending);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        activityId: 'act-1',
        status: 'COMPLETED',
      }),
    ).rejects.toBeInstanceOf(InvalidScheduleTransitionError);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects repeating the same transition', async () => {
    const inProgress = makeActivity('IN_PROGRESS');
    repository.findById.mockResolvedValue(inProgress);
    repository.findByIdForUpdate.mockResolvedValue(inProgress);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        activityId: 'act-1',
        status: 'IN_PROGRESS',
      }),
    ).rejects.toBeInstanceOf(InvalidScheduleTransitionError);

    const completed = makeActivity('COMPLETED');
    repository.findById.mockResolvedValue(completed);
    repository.findByIdForUpdate.mockResolvedValue(completed);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        activityId: 'act-1',
        status: 'COMPLETED',
      }),
    ).rejects.toBeInstanceOf(InvalidScheduleTransitionError);
  });

  it('rejects a future actual end date', async () => {
    const inProgress = makeActivity('IN_PROGRESS');
    repository.findById.mockResolvedValue(inProgress);
    repository.findByIdForUpdate.mockResolvedValue(inProgress);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        activityId: 'act-1',
        status: 'COMPLETED',
        actualEndDate: '2027-03-16',
      }),
    ).rejects.toBeInstanceOf(InvalidScheduleDataError);
  });

  it('denies a user without cronograma.editar', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'user-no-perm',
        activityId: 'act-1',
        status: 'IN_PROGRESS',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-no-perm',
      permission: 'cronograma.editar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('fails when the activity does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        activityId: 'missing-act',
        status: 'IN_PROGRESS',
      }),
    ).rejects.toBeInstanceOf(ScheduleActivityNotFoundError);

    expect(locker.lockById).not.toHaveBeenCalled();
  });

  it('fails when the activity disappears after the execution is locked', async () => {
    const pending = makeActivity('PENDING');
    repository.findById.mockResolvedValue(pending);
    repository.findByIdForUpdate.mockResolvedValue(null);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        activityId: 'act-1',
        status: 'IN_PROGRESS',
      }),
    ).rejects.toBeInstanceOf(ScheduleActivityNotFoundError);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('fails when the execution is closed or voided', async () => {
    const pending = makeActivity('PENDING');
    repository.findById.mockResolvedValue(pending);
    locker.lockById.mockResolvedValue({
      id: 'exec-1',
      status: 'CLOSED',
      type: 'P611',
    });

    await expect(
      useCase.execute({
        actorId: 'user-1',
        activityId: 'act-1',
        status: 'IN_PROGRESS',
      }),
    ).rejects.toBeInstanceOf(ScheduleExecutionClosedError);

    locker.lockById.mockResolvedValue({
      id: 'exec-1',
      status: 'VOIDED',
      type: 'P611',
    });

    await expect(
      useCase.execute({
        actorId: 'user-1',
        activityId: 'act-1',
        status: 'IN_PROGRESS',
      }),
    ).rejects.toBeInstanceOf(ScheduleExecutionClosedError);
  });

  it('locks the execution before reading the activity for update', async () => {
    const pending = makeActivity('PENDING');
    const order: string[] = [];

    repository.findById.mockImplementation(async () => {
      order.push('findById');
      return pending;
    });
    locker.lockById.mockImplementation(async () => {
      order.push('lockById');
      return { id: 'exec-1', status: 'IN_PROGRESS', type: 'P611' };
    });
    repository.findByIdForUpdate.mockImplementation(async () => {
      order.push('findByIdForUpdate');
      return pending;
    });

    await useCase.execute({
      actorId: 'user-1',
      activityId: 'act-1',
      status: 'IN_PROGRESS',
    });

    expect(order).toEqual(['findById', 'lockById', 'findByIdForUpdate']);
  });

  it('audits UPDATE with before and after', async () => {
    const pending = makeActivity('PENDING');
    repository.findById.mockResolvedValue(pending);
    repository.findByIdForUpdate.mockResolvedValue(pending);

    await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.1',
      activityId: 'act-1',
      status: 'IN_PROGRESS',
    });

    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'UPDATE',
      entity: 'ScheduleActivity',
      entityId: 'act-1',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: expect.objectContaining({ status: 'PENDING', actualEndDate: null }),
      after: expect.objectContaining({ status: 'IN_PROGRESS', actualEndDate: null }),
    });
  });

  it('leaves no audit record when the update fails', async () => {
    const pending = makeActivity('PENDING');
    repository.findById.mockResolvedValue(pending);
    repository.findByIdForUpdate.mockResolvedValue(pending);
    repository.update.mockRejectedValue(new Error('DB failure'));

    await expect(
      useCase.execute({
        actorId: 'user-1',
        activityId: 'act-1',
        status: 'IN_PROGRESS',
      }),
    ).rejects.toThrow('DB failure');

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('returns a DTO parsed with the shared schema', async () => {
    const pending = makeActivity('PENDING');
    repository.findById.mockResolvedValue(pending);
    repository.findByIdForUpdate.mockResolvedValue(pending);

    const result = await useCase.execute({
      actorId: 'user-1',
      activityId: 'act-1',
      status: 'IN_PROGRESS',
    });

    expect(scheduleActivityDtoSchema.safeParse(result).success).toBe(true);
  });
});
