import { describe, expect, it } from 'vitest';
import {
  EXECUTION_PRECONDITION_CODES,
  PRECONDITION_LABELS,
} from '../entities/process-execution-precondition.js';
import {
  evaluatePreconditions,
  nextAdvanceStatus,
  requiredPreconditions,
} from './process-execution-transitions.js';

describe('process-execution-transitions', () => {
  it('moves PLANNED to IN_PROGRESS when the schedule has an activity', () => {
    expect(nextAdvanceStatus('PLANNED')).toBe('IN_PROGRESS');

    const required = requiredPreconditions('P612', 'PLANNED');
    expect(required).toEqual(['SCHEDULE_HAS_ACTIVITY']);

    const evaluation = evaluatePreconditions(required, [
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'MET',
      },
    ]);

    expect(evaluation.allMet).toBe(true);
    expect(evaluation.unmet).toEqual([]);
  });

  it('reports every unmet precondition of IN_PROGRESS to CONSOLIDATING', () => {
    expect(nextAdvanceStatus('IN_PROGRESS')).toBe('CONSOLIDATING');

    const required = requiredPreconditions('P611', 'IN_PROGRESS');
    expect(required).toEqual(['SESSIONS_SURVEYS_CLOSED', 'SESSIONS_MINUTES_SIGNED']);

    const evaluation = evaluatePreconditions(required, [
      {
        code: 'SESSIONS_SURVEYS_CLOSED',
        label: PRECONDITION_LABELS.SESSIONS_SURVEYS_CLOSED,
        state: 'UNMET',
      },
      {
        code: 'SESSIONS_MINUTES_SIGNED',
        label: PRECONDITION_LABELS.SESSIONS_MINUTES_SIGNED,
        state: 'UNMET',
      },
    ]);

    expect(evaluation.allMet).toBe(false);
    expect(evaluation.unmet.map((item) => item.code)).toEqual([
      'SESSIONS_SURVEYS_CLOSED',
      'SESSIONS_MINUTES_SIGNED',
    ]);
  });

  it('uses measurements instead of sessions and minutes for P622', () => {
    expect(requiredPreconditions('P622', 'IN_PROGRESS')).toEqual(['MEASUREMENTS_REVIEWED']);
    expect(requiredPreconditions('P623', 'IN_PROGRESS')).toEqual([
      'SESSIONS_SURVEYS_CLOSED',
      'SESSIONS_MINUTES_SIGNED',
    ]);
  });

  it('has no advance from PENDING_APPROVAL, CLOSED or VOIDED', () => {
    expect(nextAdvanceStatus('CONSOLIDATING')).toBe('PENDING_APPROVAL');
    expect(nextAdvanceStatus('PENDING_APPROVAL')).toBeNull();
    expect(nextAdvanceStatus('CLOSED')).toBeNull();
    expect(nextAdvanceStatus('VOIDED')).toBeNull();

    expect(requiredPreconditions('P612', 'PENDING_APPROVAL')).toEqual(['RESOLUTION_APPROVED']);
    expect(requiredPreconditions('P612', 'CLOSED')).toEqual([]);
    expect(requiredPreconditions('P612', 'VOIDED')).toEqual([]);
  });

  it('treats a code without provider as not verifiable and unmet', () => {
    const required = requiredPreconditions('P612', 'CONSOLIDATING');
    expect(required).toEqual([
      'CONSOLIDATION_MINUTES_SIGNED',
      'RESULTS_CALCULATED',
      'IMPROVEMENT_ACTIONS_REGISTERED',
    ]);

    const evaluation = evaluatePreconditions(required, [
      {
        code: 'RESULTS_CALCULATED',
        label: PRECONDITION_LABELS.RESULTS_CALCULATED,
        state: 'MET',
      },
    ]);

    expect(evaluation.allMet).toBe(false);
    expect(evaluation.unmet).toEqual([
      {
        code: 'CONSOLIDATION_MINUTES_SIGNED',
        label: PRECONDITION_LABELS.CONSOLIDATION_MINUTES_SIGNED,
        state: 'NOT_VERIFIABLE',
      },
      {
        code: 'IMPROVEMENT_ACTIONS_REGISTERED',
        label: PRECONDITION_LABELS.IMPROVEMENT_ACTIONS_REGISTERED,
        state: 'NOT_VERIFIABLE',
      },
    ]);
  });

  it('lists every precondition with its Spanish label', () => {
    for (const code of EXECUTION_PRECONDITION_CODES) {
      const label = PRECONDITION_LABELS[code];
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(10);
    }
  });
});
