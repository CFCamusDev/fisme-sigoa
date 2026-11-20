import { randomUUID } from 'node:crypto';
import type { ScheduleResponse } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ScheduleExecutionNotFoundError } from '../domain/errors/index.js';
import { assertScheduleEditable } from '../domain/policies/schedule-execution-rule.js';
import { todayInLima } from '../domain/policies/schedule-overdue.js';
import { reconcileSchedule } from '../domain/policies/schedule-reconciliation.js';
import type {
  ProcessPermissionChecker,
  ScheduleActivityRepository,
  ScheduleExecutionLocker,
} from '../domain/ports/index.js';
import type { SaveScheduleCommand } from './save-schedule.types.js';
import { buildScheduleResponse } from './schedule-activity-dto.js';

export interface SaveScheduleDependencies {
  readonly scheduleExecutionLocker: ScheduleExecutionLocker;
  readonly scheduleActivityRepository: ScheduleActivityRepository;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Guarda el cronograma completo de una ejecución mediante conciliación atómica (HU-028, RF-028).
 */
export class SaveScheduleUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: SaveScheduleDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: SaveScheduleCommand): Promise<ScheduleResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'cronograma.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const execution = await this.deps.scheduleExecutionLocker.lockById(command.executionId);
      if (!execution) {
        throw new ScheduleExecutionNotFoundError(command.executionId);
      }

      assertScheduleEditable(execution.status);

      const existing = await this.deps.scheduleActivityRepository.findByExecutionId(
        command.executionId,
      );
      const now = this.clock();

      const plan = reconcileSchedule({
        executionId: command.executionId,
        existing,
        incoming: command.activities,
        actorId: command.actorId,
        now,
        idGenerator: this.idGenerator,
      });

      if (plan.toDelete.length > 0) {
        await this.deps.scheduleActivityRepository.deleteMany(plan.toDelete.map((item) => item.id));
      }

      for (const updated of plan.toUpdate) {
        await this.deps.scheduleActivityRepository.update(updated.after);
      }

      if (plan.toCreate.length > 0) {
        await this.deps.scheduleActivityRepository.insertMany(plan.toCreate);
      }

      for (const deleted of plan.toDelete) {
        await this.deps.auditLogger.log({
          action: 'VOID',
          entity: 'ScheduleActivity',
          entityId: deleted.id,
          actor: command.actorId,
          ip: command.ip ?? undefined,
          before: deleted.snapshot(),
          after: null,
        });
      }

      for (const updated of plan.toUpdate) {
        await this.deps.auditLogger.log({
          action: 'UPDATE',
          entity: 'ScheduleActivity',
          entityId: updated.after.id,
          actor: command.actorId,
          ip: command.ip ?? undefined,
          before: updated.before.snapshot(),
          after: updated.after.snapshot(),
        });
      }

      for (const created of plan.toCreate) {
        await this.deps.auditLogger.log({
          action: 'CREATE',
          entity: 'ScheduleActivity',
          entityId: created.id,
          actor: command.actorId,
          ip: command.ip ?? undefined,
          before: null,
          after: created.snapshot(),
        });
      }

      return buildScheduleResponse(plan.orderedActivities, todayInLima(now));
    });
  }
}
