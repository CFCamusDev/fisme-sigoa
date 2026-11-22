import {
  voidProcessExecutionResponseSchema,
  type VoidProcessExecutionResponse,
} from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ScheduleExecutionNotFoundError } from '../domain/errors/index.js';
import type {
  ProcessExecutionRepository,
  ProcessPermissionChecker,
} from '../domain/ports/index.js';
import type { VoidProcessExecutionCommand } from './void-process-execution.types.js';

export interface VoidProcessExecutionDependencies {
  readonly processExecutionRepository: ProcessExecutionRepository;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Anula una ejecución de proceso no cerrada registrando el motivo y la auditoría (HU-030, RF-030, RS-020).
 */
export class VoidProcessExecutionUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: VoidProcessExecutionDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: VoidProcessExecutionCommand): Promise<VoidProcessExecutionResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'ejecucion.anular',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const execution = await this.deps.processExecutionRepository.findByIdForUpdate(
        command.executionId,
      );
      if (!execution) {
        throw new ScheduleExecutionNotFoundError(command.executionId);
      }

      const nextExecution = execution.void({
        actorId: command.actorId,
        now: this.clock(),
        reason: command.reason,
      });

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

      return voidProcessExecutionResponseSchema.parse({
        executionId: nextExecution.id,
        previousStatus: execution.status,
        status: 'VOIDED',
        voidReason: nextExecution.voidReason,
        updatedAt: nextExecution.updatedAt.toISOString(),
      });
    });
  }
}
