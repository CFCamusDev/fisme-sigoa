import { executionBoardResponseSchema, type ExecutionBoardResponse } from '@sigoa/shared';
import { ScheduleExecutionNotFoundError } from '../domain/errors/index.js';
import {
  getExecutionBoardPendingTarget,
  summarizeSchedule,
} from '../domain/policies/execution-board-targets.js';
import { nextAdvanceStatus } from '../domain/policies/process-execution-transitions.js';
import { todayInLima } from '../domain/policies/schedule-overdue.js';
import type {
  ExecutionBoardSessionsReader,
  ProcessExecutionReader,
  ProcessPermissionChecker,
  ScheduleActivityRepository,
} from '../domain/ports/index.js';
import type { ExecutionPreconditionEvaluator } from './execution-precondition-evaluator.js';
import type { GetExecutionBoardQuery } from './get-execution-board.types.js';
import { buildProcessExecutionDto } from './process-execution-dto.js';

export interface GetExecutionBoardDependencies {
  readonly processExecutionReader: ProcessExecutionReader;
  readonly scheduleActivityRepository: ScheduleActivityRepository;
  readonly boardSessionsReader: ExecutionBoardSessionsReader;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly preconditionEvaluator: ExecutionPreconditionEvaluator;
  readonly clock?: () => Date;
}

/**
 * Construye el tablero de lectura de una ejecución de proceso (HU-031).
 * No modifica estado ni registra auditoría.
 */
export class GetExecutionBoardUseCase {
  constructor(private readonly deps: GetExecutionBoardDependencies) {}

  async execute(query: GetExecutionBoardQuery): Promise<ExecutionBoardResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'ejecucion.ver',
      scope: 'GLOBAL',
    });

    const readItem = await this.deps.processExecutionReader.findReadItemById(query.executionId);
    if (!readItem) {
      throw new ScheduleExecutionNotFoundError(query.executionId);
    }

    const now = this.deps.clock ? this.deps.clock() : new Date();
    const today = todayInLima(now);

    const [activities, sessions] = await Promise.all([
      this.deps.scheduleActivityRepository.findByExecutionId(readItem.execution.id),
      this.deps.boardSessionsReader.summarize(readItem.execution.id),
    ]);

    const schedule = summarizeSchedule(activities, today);
    const nextStatus = nextAdvanceStatus(readItem.execution.status);

    let pending: ExecutionBoardResponse['pending'] = [];
    if (nextStatus) {
      const evaluation = await this.deps.preconditionEvaluator.evaluate(readItem.execution);
      pending = evaluation.items
        .filter((item) => item.state !== 'MET')
        .map((item) => ({
          code: item.code,
          label: item.label,
          state: item.state === 'UNMET' ? 'UNMET' : 'NOT_VERIFIABLE',
          target: getExecutionBoardPendingTarget(item.code),
        }));
    }

    return executionBoardResponseSchema.parse({
      execution: buildProcessExecutionDto(readItem.execution, {
        semesterCode: readItem.semesterCode,
        catalogVersionNumber: readItem.catalogVersionNumber,
      }),
      schedule,
      sessions: {
        total: sessions.total,
        lastSessionDate: sessions.lastSessionDate,
        items: [...sessions.items],
      },
      surveys: { available: false },
      minutes: { available: false },
      results: { available: false },
      pending,
      nextStatus,
      generatedAt: now.toISOString(),
    });
  }
}
