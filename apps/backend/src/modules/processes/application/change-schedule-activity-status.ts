import type { ScheduleActivityDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  ScheduleActivityNotFoundError,
  ScheduleExecutionNotFoundError,
} from '../domain/errors/index.js';
import { assertScheduleEditable } from '../domain/policies/schedule-execution-rule.js';
import { todayInLima } from '../domain/policies/schedule-overdue.js';
import type {
  ProcessPermissionChecker,
  ScheduleActivityRepository,
  ScheduleExecutionLocker,
} from '../domain/ports/index.js';
import type { ChangeScheduleActivityStatusCommand } from './change-schedule-activity-status.types.js';
import { buildScheduleActivityDto } from './schedule-activity-dto.js';

export interface ChangeScheduleActivityStatusDependencies {
  readonly scheduleExecutionLocker: ScheduleExecutionLocker;
  readonly scheduleActivityRepository: ScheduleActivityRepository;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Cambia el estado de una actividad del cronograma (PENDING -> IN_PROGRESS -> COMPLETED) (HU-028, LS 5.2).
 */
export class ChangeScheduleActivityStatusUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: ChangeScheduleActivityStatusDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: ChangeScheduleActivityStatusCommand): Promise<ScheduleActivityDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'cronograma.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const initial = await this.deps.scheduleActivityRepository.findById(command.activityId);
      if (!initial) {
        throw new ScheduleActivityNotFoundError(command.activityId);
      }

      const execution = await this.deps.scheduleExecutionLocker.lockById(
        initial.processExecutionId,
      );
      if (!execution) {
        throw new ScheduleExecutionNotFoundError(initial.processExecutionId);
      }

      assertScheduleEditable(execution.status);

      const current = await this.deps.scheduleActivityRepository.findByIdForUpdate(
        command.activityId,
      );
      if (!current) {
        throw new ScheduleActivityNotFoundError(command.activityId);
      }

      const now = this.clock();
      const today = todayInLima(now);

      const updated =
        command.status === 'IN_PROGRESS'
          ? current.start({ actorId: command.actorId, now })
          : current.complete({
              actualEndDate: command.actualEndDate,
              today,
              actorId: command.actorId,
              now,
            });

      await this.deps.scheduleActivityRepository.update(updated);

      await this.deps.auditLogger.log({
        action: 'UPDATE',
        entity: 'ScheduleActivity',
        entityId: updated.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: current.snapshot(),
        after: updated.snapshot(),
      });

      return buildScheduleActivityDto(updated, today);
    });
  }
}
