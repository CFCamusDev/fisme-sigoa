import { describe, expect, it } from 'vitest';
import {
  advanceProcessExecutionRequestSchema,
  advanceProcessExecutionResponseSchema,
  executionPreconditionResultSchema,
  nextTransitionResponseSchema,
} from './process-execution-transitions.js';
import { PROCESS_EXECUTION_ID_MAX_LENGTH } from './process-executions.js';
import { processExecutionIdParamSchema } from './sessions.js';

describe('process-execution-transitions schemas', () => {
  it('accepts an empty advance body', () => {
    const result = advanceProcessExecutionRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields in the advance body', () => {
    const result = advanceProcessExecutionRequestSchema.safeParse({ extra: true });
    expect(result.success).toBe(false);
  });

  it('parses a next transition with a null next status', () => {
    const result = nextTransitionResponseSchema.safeParse({
      executionId: 'exec-1',
      status: 'PENDING_APPROVAL',
      nextStatus: null,
      preconditions: [],
      canAdvance: false,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown precondition code', () => {
    const result = executionPreconditionResultSchema.safeParse({
      code: 'UNKNOWN_CODE',
      label: 'Algo',
      state: 'MET',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an id over 64 characters', () => {
    const overMax = 'a'.repeat(PROCESS_EXECUTION_ID_MAX_LENGTH + 1);
    expect(processExecutionIdParamSchema.safeParse({ id: overMax }).success).toBe(false);
    expect(processExecutionIdParamSchema.safeParse({ id: 'exec-1' }).success).toBe(true);
  });

  it('parses an advance response', () => {
    const result = advanceProcessExecutionResponseSchema.safeParse({
      executionId: 'exec-1',
      previousStatus: 'PLANNED',
      status: 'IN_PROGRESS',
      updatedAt: '2027-01-20T12:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });
});
