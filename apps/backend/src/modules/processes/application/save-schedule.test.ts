import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ScheduleActivity } from '../domain/entities/schedule-activity.js';
import {
  InvalidScheduleDataError,
  ScheduleActivityInUseError,
  ScheduleExecutionClosedError,
} from '../domain/errors/index.js';
import type {
  ProcessPermissionChecker,
  ScheduleActivityRepository,
  ScheduleExecutionLocker,
} from '../domain/ports/index.js';
import { SaveScheduleUseCase } from './save-schedule.js';

const BASE_NOW = new Date('2027-03-01T10:00:00.000Z');
const LATER_NOW = new Date('2027-03-10T15:00:00.000Z');

describe('SaveScheduleUseCase (HU-028, T-028-06, T-028-18)', () => {
  let locker: MockProxy<ScheduleExecutionLocker>;
  let repository: MockProxy<ScheduleActivityRepository>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let seq: number;
  let useCase: SaveScheduleUseCase;

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

    useCase = new SaveScheduleUseCase({
      scheduleExecutionLocker: locker,
      scheduleActivityRepository: repository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => {
        seq += 1;
        return `new-${seq}`;
      },
      clock: () => LATER_NOW,
    });
  });

  function makeActivity(params: {
    id: string;
    number: number;
    activity: string;
    status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  }): ScheduleActivity {
    return ScheduleActivity.rehydrate({
      id: params.id,
      processExecutionId: 'exec-1',
      number: params.number,
      activity: params.activity,
      responsible: 'Presidente',
      goal: 'Anexo 1',
      indicator: '1 documento',
      startDate: '2027-03-01',
      endDate: '2027-03-20',
      status: params.status ?? 'PENDING',
      actualEndDate: params.status === 'COMPLETED' ? '2027-03-10' : null,
      createdBy: 'user-1',
      updatedBy: null,
      createdAt: BASE_NOW,
      updatedAt: BASE_NOW,
    });
  }

  it('creates new activities numbered by position', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.1',
      executionId: 'exec-1',
      activities: [
        { activity: 'Paso A', responsible: 'Presidente' },
        { activity: 'Paso B', responsible: 'Decano', goal: 'Resolución' },
      ],
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.id).toBe('new-1');
    expect(result.items[0]?.number).toBe(1);
    expect(result.items[1]?.id).toBe('new-2');
    expect(result.items[1]?.number).toBe(2);
    expect(repository.insertMany).toHaveBeenCalledTimes(1);
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.deleteMany).not.toHaveBeenCalled();
  });

  it('updates an activity without changing its status', async () => {
    const existing = makeActivity({
      id: 'act-1',
      number: 1,
      activity: 'Original',
      status: 'IN_PROGRESS',
    });
    repository.findByExecutionId.mockResolvedValue([existing]);

    const result = await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-1',
      activities: [
        {
          id: 'act-1',
          activity: 'Actualizada',
          responsible: 'Comité',
          goal: 'Anexo 1',
          indicator: '1 documento',
          startDate: '2027-03-01',
          endDate: '2027-03-20',
        },
      ],
    });

    expect(result.items[0]?.activity).toBe('Actualizada');
    expect(result.items[0]?.status).toBe('IN_PROGRESS');
    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it('renumbers when the order changes', async () => {
    const first = makeActivity({ id: 'act-1', number: 1, activity: 'Primera' });
    const second = makeActivity({ id: 'act-2', number: 2, activity: 'Segunda' });
    repository.findByExecutionId.mockResolvedValue([first, second]);

    const result = await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-1',
      activities: [
        {
          id: 'act-2',
          activity: 'Segunda',
          responsible: 'Presidente',
          goal: 'Anexo 1',
          indicator: '1 documento',
          startDate: '2027-03-01',
          endDate: '2027-03-20',
        },
        {
          id: 'act-1',
          activity: 'Primera',
          responsible: 'Presidente',
          goal: 'Anexo 1',
          indicator: '1 documento',
          startDate: '2027-03-01',
          endDate: '2027-03-20',
        },
      ],
    });

    expect(result.items.map((item) => item.id)).toEqual(['act-2', 'act-1']);
    expect(result.items.map((item) => item.number)).toEqual([1, 2]);
    expect(repository.update).toHaveBeenCalledTimes(2);
  });

  it('deletes a removed PENDING activity', async () => {
    const first = makeActivity({ id: 'act-1', number: 1, activity: 'Primera' });
    const second = makeActivity({ id: 'act-2', number: 2, activity: 'Segunda' });
    repository.findByExecutionId.mockResolvedValue([first, second]);

    const result = await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-1',
      activities: [
        {
          id: 'act-1',
          activity: 'Primera',
          responsible: 'Presidente',
          goal: 'Anexo 1',
          indicator: '1 documento',
          startDate: '2027-03-01',
          endDate: '2027-03-20',
        },
      ],
    });

    expect(result.items.map((item) => item.id)).toEqual(['act-1']);
    expect(repository.deleteMany).toHaveBeenCalledWith(['act-2']);
  });

  it('rejects removing an IN_PROGRESS or COMPLETED activity', async () => {
    repository.findByExecutionId.mockResolvedValue([
      makeActivity({ id: 'act-ip', number: 1, activity: 'En curso', status: 'IN_PROGRESS' }),
    ]);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-1',
        activities: [],
      }),
    ).rejects.toBeInstanceOf(ScheduleActivityInUseError);

    repository.findByExecutionId.mockResolvedValue([
      makeActivity({ id: 'act-done', number: 1, activity: 'Completada', status: 'COMPLETED' }),
    ]);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-1',
        activities: [],
      }),
    ).rejects.toBeInstanceOf(ScheduleActivityInUseError);
  });

  it('rejects an id that belongs to another execution', async () => {
    repository.findByExecutionId.mockResolvedValue([]);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-1',
        activities: [{ id: 'foreign-id', activity: 'Ajena', responsible: 'Presidente' }],
      }),
    ).rejects.toBeInstanceOf(InvalidScheduleDataError);
  });

  it('rejects repeated ids', async () => {
    const existing = makeActivity({ id: 'act-1', number: 1, activity: 'Única' });
    repository.findByExecutionId.mockResolvedValue([existing]);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-1',
        activities: [
          { id: 'act-1', activity: 'Única', responsible: 'Presidente' },
          { id: 'act-1', activity: 'Repetida', responsible: 'Presidente' },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidScheduleDataError);
  });

  it('does not audit unchanged activities', async () => {
    const existing = makeActivity({ id: 'act-1', number: 1, activity: 'Sin cambios' });
    repository.findByExecutionId.mockResolvedValue([existing]);

    await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-1',
      activities: [
        {
          id: 'act-1',
          activity: 'Sin cambios',
          responsible: 'Presidente',
          goal: 'Anexo 1',
          indicator: '1 documento',
          startDate: '2027-03-01',
          endDate: '2027-03-20',
        },
      ],
    });

    expect(repository.update).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('audits CREATE, UPDATE and DELETE with before and after', async () => {
    const toKeep = makeActivity({ id: 'act-1', number: 1, activity: 'Original' });
    const toDelete = makeActivity({ id: 'act-2', number: 2, activity: 'Eliminada' });
    repository.findByExecutionId.mockResolvedValue([toKeep, toDelete]);

    await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.1',
      executionId: 'exec-1',
      activities: [
        {
          id: 'act-1',
          activity: 'Modificada',
          responsible: 'Presidente',
          goal: 'Anexo 1',
          indicator: '1 documento',
          startDate: '2027-03-01',
          endDate: '2027-03-20',
        },
        {
          activity: 'Nueva',
          responsible: 'Decano',
        },
      ],
    });

    expect(auditLogger.log).toHaveBeenCalledTimes(3);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'ScheduleActivity',
        entityId: 'act-2',
        before: expect.objectContaining({ id: 'act-2', activity: 'Eliminada' }),
        after: null,
      }),
    );
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        entity: 'ScheduleActivity',
        entityId: 'act-1',
        before: expect.objectContaining({ activity: 'Original' }),
        after: expect.objectContaining({ activity: 'Modificada' }),
      }),
    );
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'ScheduleActivity',
        entityId: 'new-1',
        before: null,
        after: expect.objectContaining({ activity: 'Nueva', number: 2 }),
      }),
    );
  });

  it('accepts an empty list when all existing activities are PENDING', async () => {
    repository.findByExecutionId.mockResolvedValue([
      makeActivity({ id: 'act-1', number: 1, activity: 'Pendiente' }),
    ]);

    const result = await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-1',
      activities: [],
    });

    expect(result.items).toEqual([]);
    expect(repository.deleteMany).toHaveBeenCalledWith(['act-1']);
  });

  it('denies a user without cronograma.editar', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'user-no-perm',
        executionId: 'exec-1',
        activities: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-no-perm',
      permission: 'cronograma.editar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('fails when the execution is closed', async () => {
    locker.lockById.mockResolvedValue({
      id: 'exec-1',
      status: 'CLOSED',
      type: 'P611',
    });

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-1',
        activities: [],
      }),
    ).rejects.toBeInstanceOf(ScheduleExecutionClosedError);
  });
});
