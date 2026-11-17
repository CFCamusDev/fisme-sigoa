import type { Prisma } from '../../../../shared/prisma/generated/client.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ProcessExecution } from '../../domain/entities/process-execution.js';
import { DuplicateProcessExecutionError } from '../../domain/errors/duplicate-process-execution-error.js';
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
}
