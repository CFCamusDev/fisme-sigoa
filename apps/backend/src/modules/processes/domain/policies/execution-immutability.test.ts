import { describe, expect, it } from 'vitest';
import { ExecutionContentFrozenError } from '../errors/execution-content-frozen-error.js';
import { assertExecutionContentEditable, isExecutionFrozen } from './execution-immutability.js';

describe('execution-immutability', () => {
  it('freezes the content of a CLOSED execution', () => {
    expect(isExecutionFrozen('CLOSED')).toBe(true);
    expect(() => assertExecutionContentEditable('CLOSED')).toThrow(ExecutionContentFrozenError);
    expect(() => assertExecutionContentEditable('CLOSED')).toThrow('Cerrada');
  });

  it('freezes the content of a VOIDED execution', () => {
    expect(isExecutionFrozen('VOIDED')).toBe(true);
    expect(() => assertExecutionContentEditable('VOIDED')).toThrow(ExecutionContentFrozenError);
    expect(() => assertExecutionContentEditable('VOIDED')).toThrow('Anulada');
  });

  it('keeps the content of an open execution editable', () => {
    for (const status of ['PLANNED', 'IN_PROGRESS', 'CONSOLIDATING', 'PENDING_APPROVAL'] as const) {
      expect(isExecutionFrozen(status)).toBe(false);
      expect(() => assertExecutionContentEditable(status)).not.toThrow();
    }
  });
});
