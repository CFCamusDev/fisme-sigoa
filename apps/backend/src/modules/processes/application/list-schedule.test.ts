import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { ScheduleActivity } from '../domain/entities/schedule-activity.js';
import { ScheduleExecutionNotFoundError } from '../domain/errors/index.js';
import type {
  ProcessExecutionReader,
  ProcessPermissionChecker,
  ScheduleActivityRepository,
} from '../domain/ports/index.js';
import { ListScheduleUseCase } from './list-schedule.js';

const BASE_NOW = new Date('2027-03-01T10:00:00.000Z');
// 2027-03-16T03:00:00Z es 2027-03-15 22:00 en America/Lima
const QUERY_NOW = new Date('2027-03-16T03:00:00.000Z');

describe('ListScheduleUseCase (HU-028, D8, T-028-18)', () => {
  let processExecutionReader: MockProxy<ProcessExecutionReader>;
  let scheduleActivityRepository: MockProxy<ScheduleActivityRepository>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let useCase: ListScheduleUseCase;

  beforeEach(() => {
    processExecutionReader = mock<ProcessExecutionReader>();
    scheduleActivityRepository = mock<ScheduleActivityRepository>();
    permissionChecker = mock<ProcessPermissionChecker>();

    processExecutionReader.existsById.mockResolvedValue(true);
    scheduleActivityRepository.findByExecutionId.mockResolvedValue([]);

    useCase = new ListScheduleUseCase({
      processExecutionReader,
      scheduleActivityRepository,
      permissionChecker,
      clock: () => QUERY_NOW,
    });
  });

  it('returns activities ordered with isOverdue computed', async () => {
    const overdue = ScheduleActivity.create({
      id: 'act-1',
      executionId: 'exec-1',
      number: 1,
      activity: 'Vencida',
      responsible: 'Presidente',
      endDate: '2027-03-14',
      actorId: 'user-1',
      now: BASE_NOW,
    });
    const dueToday = ScheduleActivity.create({
      id: 'act-2',
      executionId: 'exec-1',
      number: 2,
      activity: 'Vence hoy',
      responsible: 'Presidente',
      endDate: '2027-03-15',
      actorId: 'user-1',
      now: BASE_NOW,
    });
    const completedPast = ScheduleActivity.create({
      id: 'act-3',
      executionId: 'exec-1',
      number: 3,
      activity: 'Completada a tiempo',
      responsible: 'Presidente',
      endDate: '2027-03-10',
      actorId: 'user-1',
      now: BASE_NOW,
    })
      .start({ actorId: 'user-1', now: BASE_NOW })
      .complete({
        actualEndDate: '2027-03-09',
        today: '2027-03-15',
        actorId: 'user-1',
        now: BASE_NOW,
      });

    scheduleActivityRepository.findByExecutionId.mockResolvedValue([
      overdue,
      dueToday,
      completedPast,
    ]);

    const result = await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-1',
    });

    expect(result.items.map((item) => item.id)).toEqual(['act-1', 'act-2', 'act-3']);
    expect(result.items[0]?.isOverdue).toBe(true);
    expect(result.items[1]?.isOverdue).toBe(false);
    expect(result.items[2]?.isOverdue).toBe(false);
  });

  it('denies a user without cronograma.ver', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'user-no-perm',
        executionId: 'exec-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-no-perm',
      permission: 'cronograma.ver',
      scope: 'GLOBAL',
    });
    expect(processExecutionReader.existsById).not.toHaveBeenCalled();
  });

  it('fails when the execution does not exist', async () => {
    processExecutionReader.existsById.mockResolvedValue(false);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'missing-exec',
      }),
    ).rejects.toBeInstanceOf(ScheduleExecutionNotFoundError);

    expect(scheduleActivityRepository.findByExecutionId).not.toHaveBeenCalled();
  });
});
