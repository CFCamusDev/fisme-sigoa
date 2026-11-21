import type {
  Prisma,
  ProcessExecution as PrismaProcessExecutionRow,
} from '../../../../shared/prisma/generated/client.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ProcessExecution } from '../../domain/entities/process-execution.js';
import type { ProcessExecutionStatus } from '../../domain/entities/process-execution-status.js';
import { DuplicateProcessExecutionError } from '../../domain/errors/duplicate-process-execution-error.js';
import { ExecutionStatusConflictError } from '../../domain/errors/execution-status-conflict-error.js';
import type {
  ListProcessExecutionsFilter,
  ProcessExecutionPage,
  ProcessExecutionReader,
} from '../../domain/ports/process-execution-reader.js';
import type { ProcessExecutionRepository } from '../../domain/ports/process-execution-repository.js';
import { mapPrismaProcessExecutionRowToDomain } from './prisma-process-execution-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

export class PrismaProcessExecutionRepository
  implements ProcessExecutionRepository, ProcessExecutionReader
{
  constructor(private readonly dbProvider: DbProvider) {}

  async save(execution: ProcessExecution): Promise<void> {
    try {
      await this.dbProvider.get().processExecution.create({
        data: {
          id: execution.id,
          programId: execution.programId,
          type: execution.type,
          name: execution.name,
          year: execution.year,
          semesterId: execution.semesterId,
          catalogVersionId: execution.catalogVersionId,
          status: execution.status,
          createdBy: execution.createdBy,
          updatedBy: execution.updatedBy,
          createdAt: execution.createdAt,
          updatedAt: execution.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateProcessExecutionError(execution.name);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ProcessExecution | null> {
    const row = await this.dbProvider.get().processExecution.findUnique({
      where: { id },
    });
    return row ? mapPrismaProcessExecutionRowToDomain(row) : null;
  }

  async findByIdForUpdate(id: string): Promise<ProcessExecution | null> {
    const rows = await this.dbProvider.get().$queryRaw<PrismaProcessExecutionRow[]>`
      SELECT
        "id",
        "programId",
        "type",
        "name",
        "year",
        "semesterId",
        "catalogVersionId",
        "status",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
      FROM "process_executions"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? mapPrismaProcessExecutionRowToDomain(row) : null;
  }

  async updateStatus(
    execution: ProcessExecution,
    expectedStatus: ProcessExecutionStatus,
  ): Promise<void> {
    const result = await this.dbProvider.get().processExecution.updateMany({
      where: {
        id: execution.id,
        status: expectedStatus,
      },
      data: {
        status: execution.status,
        updatedBy: execution.updatedBy,
        updatedAt: execution.updatedAt,
      },
    });

    if (result.count !== 1) {
      throw new ExecutionStatusConflictError();
    }
  }

  async list(filter: ListProcessExecutionsFilter): Promise<ProcessExecutionPage> {
    const where: Prisma.ProcessExecutionWhereInput = {};
    if (filter.type !== undefined) {
      where.type = filter.type;
    }
    if (filter.year !== undefined) {
      where.year = filter.year;
    }
    if (filter.status !== undefined) {
      where.status = filter.status;
    }

    const db = this.dbProvider.get();
    const total = await db.processExecution.count({ where });
    const rows = await db.processExecution.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      include: {
        semester: { select: { code: true } },
        catalogVersion: { select: { number: true } },
      },
    });

    return {
      items: rows.map((row) => ({
        execution: mapPrismaProcessExecutionRowToDomain(row),
        semesterCode: row.semester?.code ?? null,
        catalogVersionNumber: row.catalogVersion.number,
      })),
      total,
    };
  }

  async existsById(id: string): Promise<boolean> {
    const row = await this.dbProvider.get().processExecution.findUnique({
      where: { id },
      select: { id: true },
    });
    return row !== null;
  }
}
