import { randomUUID } from 'node:crypto';
import type { ScheduleResponse } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ScheduleActivity } from '../domain/entities/schedule-activity.js';
import {
  ScheduleAlreadyDefinedError,
  ScheduleExecutionNotFoundError,
} from '../domain/errors/index.js';
import { buildProposedActivities } from '../domain/policies/procedure-steps.js';
import { assertScheduleEditable } from '../domain/policies/schedule-execution-rule.js';
import { todayInLima } from '../domain/policies/schedule-overdue.js';
import type {
  ProcessPermissionChecker,
  ScheduleActivityRepository,
  ScheduleExecutionLocker,
} from '../domain/ports/index.js';
import type { ProposeScheduleCommand } from './propose-schedule.types.js';
import { buildScheduleResponse } from './schedule-activity-dto.js';

export interface ProposeScheduleDependencies {
  readonly scheduleExecutionLocker: ScheduleExecutionLocker;
  readonly scheduleActivityRepository: ScheduleActivityRepository;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Propone el cronograma inicial de una ejecución a partir de los pasos oficiales de su procedimiento (HU-028, RF-028).
 */
export class ProposeScheduleUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: ProposeScheduleDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: ProposeScheduleCommand): Promise<ScheduleResponse> {
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
      if (existing.length > 0) {
        throw new ScheduleAlreadyDefinedError();
      }

      const now = this.clock();
      const drafts = buildProposedActivities(execution.type);
      const activities = drafts.map((draft) =>
        ScheduleActivity.create({
          id: this.idGenerator(),
          executionId: command.executionId,
          number: draft.number,
          activity: draft.activity,
          responsible: draft.responsible,
          goal: draft.goal,
          actorId: command.actorId,
          now,
        }),
      );

      await this.deps.scheduleActivityRepository.insertMany(activities);

      for (const activity of activities) {
        await this.deps.auditLogger.log({
          action: 'CREATE',
          entity: 'ScheduleActivity',
          entityId: activity.id,
          actor: command.actorId,
          ip: command.ip ?? undefined,
          before: null,
          after: activity.snapshot(),
        });
      }

      return buildScheduleResponse(activities, todayInLima(now));
    });
  }
}
