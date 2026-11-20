import { describe, expect, it } from 'vitest';
import { assertScheduleEditable } from './schedule-execution-rule.js';
import { ScheduleExecutionClosedError } from '../errors/schedule-execution-closed-error.js';

describe('assertScheduleEditable', () => {
  it('allows PLANNED, IN_PROGRESS, CONSOLIDATING and PENDING_APPROVAL', () => {
    expect(() => assertScheduleEditable('PLANNED')).not.toThrow();
    expect(() => assertScheduleEditable('IN_PROGRESS')).not.toThrow();
    expect(() => assertScheduleEditable('CONSOLIDATING')).not.toThrow();
    expect(() => assertScheduleEditable('PENDING_APPROVAL')).not.toThrow();
  });

  it('rejects CLOSED and VOIDED', () => {
    expect(() => assertScheduleEditable('CLOSED')).toThrow(ScheduleExecutionClosedError);
    expect(() => assertScheduleEditable('VOIDED')).toThrow(ScheduleExecutionClosedError);
  });
});
