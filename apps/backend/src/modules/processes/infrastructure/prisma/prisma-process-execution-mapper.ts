import type { ProcessExecution as PrismaProcessExecutionRow } from '../../../../shared/prisma/generated/client.js';
import { ProcessExecution } from '../../domain/entities/process-execution.js';
import type { ProcessExecutionStatus } from '../../domain/entities/process-execution-status.js';
import type { ProcessType } from '../../domain/entities/process-type.js';

export function mapPrismaProcessExecutionRowToDomain(
  row: PrismaProcessExecutionRow,
): ProcessExecution {
  return ProcessExecution.rehydrate({
    id: row.id,
    programId: row.programId,
    type: row.type as ProcessType,
    name: row.name,
    year: row.year,
    semesterId: row.semesterId,
    catalogVersionId: row.catalogVersionId,
    status: row.status as ProcessExecutionStatus,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
