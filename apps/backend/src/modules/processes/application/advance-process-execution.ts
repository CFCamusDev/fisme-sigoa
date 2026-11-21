import {
  advanceProcessExecutionResponseSchema,
  type AdvanceProcessExecutionResponse,
} from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  ExecutionPreconditionsNotMetError,
  ScheduleExecutionNotFoundError,
} from '../domain/errors/index.js';
import type {
  ProcessExecutionRepository,
  ProcessPermissionChecker,
} from '../domain/ports/index.js';
import type { AdvanceProcessExecutionCommand } from './advance-process-execution.types.js';
import type { ExecutionPreconditionEvaluator } from './execution-precondition-evaluator.js';

export interface AdvanceProcessExecutionDependencies {
  readonly processExecutionRepository: ProcessExecutionRepository;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly preconditionEvaluator: ExecutionPreconditionEvaluator;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Avanza una ejecución de proceso al siguiente estado de su ciclo de vida (HU-029, RF-029, RS-020).
 */
export class AdvanceProcessExecutionUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: AdvanceProcessExecutionDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: AdvanceProcessExecutionCommand): Promise<AdvanceProcessExecutionResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'ejecucion.avanzar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const execution = await this.deps.processExecutionRepository.findByIdForUpdate(
        command.executionId,
      );
      if (!execution) {
        throw new ScheduleExecutionNotFoundError(command.executionId);
      }

      const nextExecution = execution.advance({
        actorId: command.actorId,
        now: this.clock(),
      });

      const evaluation = await this.deps.preconditionEvaluator.evaluate(execution);
      if (!evaluation.allMet) {
        throw new ExecutionPreconditionsNotMetError(evaluation.unmet);
      }

      await this.deps.processExecutionRepository.updateStatus(nextExecution, execution.status);

      await this.deps.auditLogger.log({
        action: 'STATE_CHANGE',
        entity: 'ProcessExecution',
        entityId: execution.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: execution.snapshot(),
        after: nextExecution.snapshot(),
      });

      return advanceProcessExecutionResponseSchema.parse({
        executionId: nextExecution.id,
        previousStatus: execution.status,
        status: nextExecution.status,
        updatedAt: nextExecution.updatedAt.toISOString(),
      });
    });
  }
}
