import { randomUUID } from 'node:crypto';
import type { ProcessExecutionDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ProcessExecution } from '../domain/entities/process-execution.js';
import {
  ProcessCatalogVersionNotFoundError,
  ProcessProgramNotConfiguredError,
  ProcessSemesterNotFoundError,
} from '../domain/errors/index.js';
import type {
  ProcessCatalogVersionReader,
  ProcessExecutionRepository,
  ProcessPermissionChecker,
  ProcessProgramResolver,
  ProcessSemesterReader,
  ProcessSemesterRecord,
} from '../domain/ports/index.js';
import type { CreateProcessExecutionCommand } from './create-process-execution.types.js';
import { buildProcessExecutionDto } from './process-execution-dto.js';

export interface CreateProcessExecutionDependencies {
  readonly processExecutionRepository: ProcessExecutionRepository;
  readonly programResolver: ProcessProgramResolver;
  readonly catalogVersionReader: ProcessCatalogVersionReader;
  readonly semesterReader: ProcessSemesterReader;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Crea una ejecución de uno de los 6 procesos en estado inicial PLANNED (HU-027, RF-027, RS-001).
 */
export class CreateProcessExecutionUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: CreateProcessExecutionDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: CreateProcessExecutionCommand): Promise<ProcessExecutionDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'ejecucion.crear',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const programId = await this.deps.programResolver.getCurrentProgramId();
      if (!programId) {
        throw new ProcessProgramNotConfiguredError();
      }

      const catalogVersion = await this.deps.catalogVersionReader.findById(
        command.catalogVersionId,
      );
      if (!catalogVersion) {
        throw new ProcessCatalogVersionNotFoundError(command.catalogVersionId);
      }

      let semester: ProcessSemesterRecord | null = null;
      if (command.semesterId) {
        semester = await this.deps.semesterReader.findById(command.semesterId);
        if (!semester) {
          throw new ProcessSemesterNotFoundError(command.semesterId);
        }
      }

      const execution = ProcessExecution.create({
        id: this.idGenerator(),
        programId,
        type: command.type,
        name: command.name,
        year: command.year,
        semester,
        catalogVersion,
        actorId: command.actorId,
        now: this.clock(),
      });

      await this.deps.processExecutionRepository.save(execution);

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'ProcessExecution',
        entityId: execution.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: null,
        after: execution.snapshot(),
      });

      return buildProcessExecutionDto(execution, {
        semesterCode: semester?.code ?? null,
        catalogVersionNumber: catalogVersion.number,
      });
    });
  }
}
