import type { ScheduleResponse } from '@sigoa/shared';
import { ScheduleExecutionNotFoundError } from '../domain/errors/index.js';
import { todayInLima } from '../domain/policies/schedule-overdue.js';
import type {
  ProcessExecutionReader,
  ProcessPermissionChecker,
  ScheduleActivityRepository,
} from '../domain/ports/index.js';
import type { ListScheduleQuery } from './list-schedule.types.js';
import { buildScheduleResponse } from './schedule-activity-dto.js';

export interface ListScheduleDependencies {
  readonly processExecutionReader: ProcessExecutionReader;
  readonly scheduleActivityRepository: ScheduleActivityRepository;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly clock?: () => Date;
}

/**
 * Consulta las actividades del cronograma de una ejecución con isOverdue calculado (HU-028, D8).
 */
export class ListScheduleUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: ListScheduleDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(query: ListScheduleQuery): Promise<ScheduleResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'cronograma.ver',
      scope: 'GLOBAL',
    });

    const exists = await this.deps.processExecutionReader.existsById(query.executionId);
    if (!exists) {
      throw new ScheduleExecutionNotFoundError(query.executionId);
    }

    const activities = await this.deps.scheduleActivityRepository.findByExecutionId(
      query.executionId,
    );
    return buildScheduleResponse(activities, todayInLima(this.clock()));
  }
}
