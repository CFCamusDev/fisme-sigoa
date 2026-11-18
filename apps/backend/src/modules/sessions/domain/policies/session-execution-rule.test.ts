import { describe, expect, it } from 'vitest';
import {
  assertExecutionsLinkable,
  type SessionProcessExecutionStatus,
} from './session-execution-rule.js';
import { SessionExecutionNotOpenError } from '../errors/session-execution-not-open-error.js';

describe('assertExecutionsLinkable', () => {
  it('accepts PLANNED and IN_PROGRESS', () => {
    expect(() =>
      assertExecutionsLinkable([
        { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
        { id: 'exec-2', name: 'Medición OE 2026', status: 'IN_PROGRESS' },
      ]),
    ).not.toThrow();
  });

  it('rejects the other four statuses', () => {
    const closedStatuses: SessionProcessExecutionStatus[] = [
      'CONSOLIDATING',
      'PENDING_APPROVAL',
      'CLOSED',
      'VOIDED',
    ];

    for (const status of closedStatuses) {
      expect(() =>
        assertExecutionsLinkable([{ id: 'exec-1', name: 'Ejecución X', status }]),
      ).toThrow(SessionExecutionNotOpenError);
    }
  });
});
