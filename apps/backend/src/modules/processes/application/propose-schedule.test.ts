import { scheduleResponseSchema } from '@sigoa/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ScheduleActivity } from '../domain/entities/schedule-activity.js';
import {
  ScheduleAlreadyDefinedError,
  ScheduleExecutionClosedError,
  ScheduleExecutionNotFoundError,
} from '../domain/errors/index.js';
import type {
  ProcessPermissionChecker,
  ScheduleActivityRepository,
  ScheduleExecutionLocker,
} from '../domain/ports/index.js';
import { ProposeScheduleUseCase } from './propose-schedule.js';

const NOW = new Date('2027-03-10T15:00:00.000Z');

describe('ProposeScheduleUseCase (HU-028, T-028-05, T-028-17)', () => {
  let locker: MockProxy<ScheduleExecutionLocker>;
  let repository: MockProxy<ScheduleActivityRepository>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let seq: number;
  let useCase: ProposeScheduleUseCase;

  beforeEach(() => {
    locker = mock<ScheduleExecutionLocker>();
    repository = mock<ScheduleActivityRepository>();
    permissionChecker = mock<ProcessPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    seq = 0;

    unitOfWork.run.mockImplementation(async (work) => work());
    locker.lockById.mockResolvedValue({
      id: 'exec-1',
      status: 'PLANNED',
      type: 'P611',
    });
    repository.findByExecutionId.mockResolvedValue([]);

    useCase = new ProposeScheduleUseCase({
      scheduleExecutionLocker: locker,
      scheduleActivityRepository: repository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => {
        seq += 1;
        return `act-${seq}`;
      },
      clock: () => NOW,
    });
  });

  it('loads the 10 procedure steps of P611 as PENDING activities numbered from 1', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.1',
      executionId: 'exec-1',
    });

    expect(result.items).toHaveLength(10);
    expect(result.items.map((item) => item.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.items.every((item) => item.status === 'PENDING')).toBe(true);
    expect(result.items[0]?.activity).toContain('Elaborar cronograma');
    expect(repository.insertMany).toHaveBeenCalledTimes(1);
    expect(locker.lockById).toHaveBeenCalledWith('exec-1');
  });

  it('loads the steps of the execution type', async () => {
    locker.lockById.mockResolvedValue({
      id: 'exec-621',
      status: 'IN_PROGRESS',
      type: 'P621',
    });

    const result = await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-621',
    });

    expect(result.items).toHaveLength(13);
    expect(result.items[5]?.activity).toBe('Reunión de validación con el Comité Consultivo');
  });

  it('denies a user without cronograma.editar', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'user-no-perm',
        executionId: 'exec-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-no-perm',
      permission: 'cronograma.editar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('fails when the execution does not exist', async () => {
    locker.lockById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'missing-exec',
      }),
    ).rejects.toBeInstanceOf(ScheduleExecutionNotFoundError);

    expect(repository.insertMany).not.toHaveBeenCalled();
  });

  it('fails when the execution is closed or voided', async () => {
    locker.lockById.mockResolvedValue({
      id: 'exec-closed',
      status: 'CLOSED',
      type: 'P611',
    });

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-closed',
      }),
    ).rejects.toBeInstanceOf(ScheduleExecutionClosedError);

    locker.lockById.mockResolvedValue({
      id: 'exec-voided',
      status: 'VOIDED',
      type: 'P611',
    });

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-voided',
      }),
    ).rejects.toBeInstanceOf(ScheduleExecutionClosedError);
  });

  it('rejects a second proposal for the same execution', async () => {
    repository.findByExecutionId.mockResolvedValue([
      ScheduleActivity.create({
        id: 'existing-1',
        executionId: 'exec-1',
        number: 1,
        activity: 'Ya existente',
        responsible: 'Presidente',
        actorId: 'user-1',
        now: NOW,
      }),
    ]);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-1',
      }),
    ).rejects.toBeInstanceOf(ScheduleAlreadyDefinedError);

    expect(repository.insertMany).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('audits one CREATE per activity with the snapshot', async () => {
    locker.lockById.mockResolvedValue({
      id: 'exec-612',
      status: 'PLANNED',
      type: 'P612',
    });

    await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.1',
      executionId: 'exec-612',
    });

    expect(auditLogger.log).toHaveBeenCalledTimes(9);
    expect(auditLogger.log).toHaveBeenNthCalledWith(1, {
      action: 'CREATE',
      entity: 'ScheduleActivity',
      entityId: 'act-1',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: null,
      after: expect.objectContaining({
        id: 'act-1',
        processExecutionId: 'exec-612',
        number: 1,
        status: 'PENDING',
      }),
    });
  });

  it('leaves no audit record when the insert fails', async () => {
    repository.insertMany.mockRejectedValue(new Error('DB failure'));

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-1',
      }),
    ).rejects.toThrow('DB failure');

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('returns a DTO parsed with the shared schema', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-1',
    });

    const parsed = scheduleResponseSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
