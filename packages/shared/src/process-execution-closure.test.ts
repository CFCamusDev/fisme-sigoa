import { describe, expect, it } from 'vitest';
import {
  VOID_REASON_MAX_LENGTH,
  closeProcessExecutionRequestSchema,
  closeProcessExecutionResponseSchema,
  voidProcessExecutionRequestSchema,
  voidProcessExecutionResponseSchema,
} from './process-execution-closure.js';
import { executionPreconditionCodeSchema } from './process-execution-transitions.js';
import { PROCESS_EXECUTION_ID_MAX_LENGTH } from './process-executions.js';
import { processExecutionIdParamSchema } from './sessions.js';

describe('process-execution-closure schemas', () => {
  it('accepts an empty close body', () => {
    expect(closeProcessExecutionRequestSchema.safeParse({}).success).toBe(true);
    expect(
      closeProcessExecutionResponseSchema.safeParse({
        executionId: 'exec-1',
        previousStatus: 'PENDING_APPROVAL',
        status: 'CLOSED',
        updatedAt: '2027-02-01T10:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(executionPreconditionCodeSchema.safeParse('RESOLUTION_APPROVED').success).toBe(true);
  });

  it('rejects unknown fields in the close body', () => {
    expect(closeProcessExecutionRequestSchema.safeParse({ extra: true }).success).toBe(false);
  });

  it('requires a reason of at least 10 characters to void', () => {
    expect(voidProcessExecutionRequestSchema.safeParse({}).success).toBe(false);
    expect(voidProcessExecutionRequestSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(voidProcessExecutionRequestSchema.safeParse({ reason: '   ' }).success).toBe(false);

    const shortResult = voidProcessExecutionRequestSchema.safeParse({ reason: '123456789' });
    expect(shortResult.success).toBe(false);
    if (!shortResult.success) {
      expect(shortResult.error.issues[0]?.message).toBe(
        'El motivo debe tener al menos 10 caracteres',
      );
    }

    expect(
      voidProcessExecutionRequestSchema.safeParse({
        reason: 'Motivo válido',
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('trims the reason and rejects 501 characters', () => {
    const parsed = voidProcessExecutionRequestSchema.safeParse({
      reason: '  Proceso duplicado  ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reason).toBe('Proceso duplicado');
    }

    expect(
      voidProcessExecutionRequestSchema.safeParse({
        reason: 'A'.repeat(VOID_REASON_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('parses the void response with its reason', () => {
    const parsed = voidProcessExecutionResponseSchema.safeParse({
      executionId: 'exec-1',
      previousStatus: 'IN_PROGRESS',
      status: 'VOIDED',
      voidReason: 'Proceso duplicado',
      updatedAt: '2027-02-01T10:00:00.000Z',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an id over 64 characters', () => {
    const overMax = 'a'.repeat(PROCESS_EXECUTION_ID_MAX_LENGTH + 1);
    expect(processExecutionIdParamSchema.safeParse({ id: overMax }).success).toBe(false);
    expect(processExecutionIdParamSchema.safeParse({ id: 'exec-1' }).success).toBe(true);
  });
});
