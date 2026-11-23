import { describe, expect, it } from 'vitest';
import {
  createProcessExecutionRequestSchema,
  listProcessExecutionsQuerySchema,
  listProcessExecutionsResponseSchema,
  processExecutionDtoSchema,
} from './process-executions.js';

describe('process-executions schemas', () => {
  it('rejects unknown fields', () => {
    const createResult = createProcessExecutionRequestSchema.safeParse({
      type: 'P612',
      year: 2027,
      catalogVersionId: 'cv-1',
      extraField: 'unexpected',
    });
    expect(createResult.success).toBe(false);

    const queryResult = listProcessExecutionsQuerySchema.safeParse({
      page: 1,
      extraQuery: 'unexpected',
    });
    expect(queryResult.success).toBe(false);
  });

  it('requires semesterId only for P622', () => {
    const p622Missing = createProcessExecutionRequestSchema.safeParse({
      type: 'P622',
      year: 2027,
      catalogVersionId: 'cv-1',
    });
    expect(p622Missing.success).toBe(false);

    const p622Valid = createProcessExecutionRequestSchema.safeParse({
      type: 'P622',
      year: 2027,
      semesterId: 'sem-1',
      catalogVersionId: 'cv-1',
    });
    expect(p622Valid.success).toBe(true);

    const p612WithSemester = createProcessExecutionRequestSchema.safeParse({
      type: 'P612',
      year: 2027,
      semesterId: 'sem-1',
      catalogVersionId: 'cv-1',
    });
    expect(p612WithSemester.success).toBe(false);
  });

  it('reports the three select messages when process, semester or catalog version are missing', () => {
    const emptyResult = createProcessExecutionRequestSchema.safeParse({
      type: '',
      year: 2027,
      catalogVersionId: '',
    });
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) {
      const messages = emptyResult.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Selecciona un proceso');
      expect(messages).toContain('Selecciona una versión de catálogo');
    }

    const missingSemester = createProcessExecutionRequestSchema.safeParse({
      type: 'P622',
      year: 2027,
      semesterId: '',
      catalogVersionId: 'cv-1',
    });
    expect(missingSemester.success).toBe(false);
    if (!missingSemester.success) {
      expect(missingSemester.error.issues.map((i) => i.message)).toContain(
        'Selecciona un semestre',
      );
    }
  });

  it('rejects a year out of range', () => {
    expect(
      createProcessExecutionRequestSchema.safeParse({
        type: 'P612',
        year: 1999,
        catalogVersionId: 'cv-1',
      }).success,
    ).toBe(false);

    expect(
      createProcessExecutionRequestSchema.safeParse({
        type: 'P612',
        year: 2101,
        catalogVersionId: 'cv-1',
      }).success,
    ).toBe(false);
  });

  it('rejects a name over 150 characters', () => {
    expect(
      createProcessExecutionRequestSchema.safeParse({
        type: 'P612',
        year: 2027,
        catalogVersionId: 'cv-1',
        name: 'X'.repeat(151),
      }).success,
    ).toBe(false);
  });

  it('bounds page and pageSize', () => {
    expect(listProcessExecutionsQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    });

    expect(listProcessExecutionsQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(listProcessExecutionsQuerySchema.safeParse({ page: 10_001 }).success).toBe(false);
    expect(listProcessExecutionsQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(listProcessExecutionsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('accepts nullable semester and voidReason fields in the DTO', () => {
    const dto = processExecutionDtoSchema.parse({
      id: 'exec-1',
      type: 'P612',
      name: 'Medición anual de OE 2027',
      year: 2027,
      semesterId: null,
      semesterCode: null,
      catalogVersionId: 'cv-1',
      catalogVersionNumber: 1,
      status: 'PLANNED',
      voidReason: null,
      createdAt: '2027-01-15T10:00:00.000Z',
      updatedAt: '2027-01-15T10:00:00.000Z',
    });

    expect(dto.semesterId).toBeNull();
    expect(dto.semesterCode).toBeNull();
    expect(dto.voidReason).toBeNull();

    const list = listProcessExecutionsResponseSchema.parse({
      items: [dto],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(list.items).toHaveLength(1);
  });
});
