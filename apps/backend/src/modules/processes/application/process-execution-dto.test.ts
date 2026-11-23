import { describe, expect, it } from 'vitest';
import { ProcessExecution } from '../domain/entities/process-execution.js';
import { buildProcessExecutionDto } from './process-execution-dto.js';

describe('buildProcessExecutionDto (HU-081, T-081-05)', () => {
  it('exposes the void reason when voided and null otherwise', () => {
    const now = new Date('2027-01-15T10:00:00.000Z');
    const planned = ProcessExecution.rehydrate({
      id: 'exec-1',
      programId: 'prog-1',
      type: 'P612',
      name: 'Medición anual de OE 2027',
      year: 2027,
      semesterId: null,
      catalogVersionId: 'cv-1',
      status: 'PLANNED',
      voidReason: null,
      createdBy: 'user-1',
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(
      buildProcessExecutionDto(planned, { semesterCode: null, catalogVersionNumber: 1 }).voidReason,
    ).toBeNull();

    const voided = planned.void({
      actorId: 'user-2',
      now,
      reason: 'Ejecución duplicada por error',
    });

    expect(
      buildProcessExecutionDto(voided, { semesterCode: null, catalogVersionNumber: 1 }).voidReason,
    ).toBe('Ejecución duplicada por error');
  });
});
