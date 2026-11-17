import {
  listProcessExecutionsResponseSchema,
  type ListProcessExecutionsResponse,
} from '@sigoa/shared';
import type { ProcessExecutionReader, ProcessPermissionChecker } from '../domain/ports/index.js';
import type { ListProcessExecutionsCommand } from './list-process-executions.types.js';
import { buildProcessExecutionDto } from './process-execution-dto.js';

export interface ListProcessExecutionsDependencies {
  readonly processExecutionReader: ProcessExecutionReader;
  readonly permissionChecker: ProcessPermissionChecker;
}

/**
 * Lista las ejecuciones de proceso paginadas con filtros opcionales (HU-027, RF-027).
 * Es una consulta de solo lectura y no genera registro de auditoría (D8).
 */
export class ListProcessExecutionsUseCase {
  constructor(private readonly deps: ListProcessExecutionsDependencies) {}

  async execute(command: ListProcessExecutionsCommand): Promise<ListProcessExecutionsResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'ejecucion.ver',
      scope: 'GLOBAL',
    });

    const result = await this.deps.processExecutionReader.list({
      type: command.type,
      year: command.year,
      status: command.status,
      page: command.page,
      pageSize: command.pageSize,
    });

    const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / command.pageSize);

    return listProcessExecutionsResponseSchema.parse({
      items: result.items.map((item) =>
        buildProcessExecutionDto(item.execution, {
          semesterCode: item.semesterCode,
          catalogVersionNumber: item.catalogVersionNumber,
        }),
      ),
      page: command.page,
      pageSize: command.pageSize,
      total: result.total,
      totalPages,
    });
  }
}
