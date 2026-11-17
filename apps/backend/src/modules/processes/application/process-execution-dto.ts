import { processExecutionDtoSchema, type ProcessExecutionDto } from '@sigoa/shared';
import type { ProcessExecution } from '../domain/entities/process-execution.js';

export function buildProcessExecutionDto(
  execution: ProcessExecution,
  refs: { readonly semesterCode: string | null; readonly catalogVersionNumber: number },
): ProcessExecutionDto {
  return processExecutionDtoSchema.parse({
    id: execution.id,
    type: execution.type,
    name: execution.name,
    year: execution.year,
    semesterId: execution.semesterId,
    semesterCode: refs.semesterCode,
    catalogVersionId: execution.catalogVersionId,
    catalogVersionNumber: refs.catalogVersionNumber,
    status: execution.status,
    createdAt: execution.createdAt.toISOString(),
    updatedAt: execution.updatedAt.toISOString(),
  });
}
