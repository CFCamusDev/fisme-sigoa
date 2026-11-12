import { SCALE_CODE_PATTERN, SCALE_NAME_MAX_LENGTH } from '@sigoa/shared';
import { describe, expect, it } from 'vitest';
import { getScaleTypeLabel, suggestDuplicate } from './response-scale-labels';

describe('response scale labels (T-012-17)', () => {
  it('translates the scale types', () => {
    expect(getScaleTypeLabel('LIKERT')).toBe('Likert');
    expect(getScaleTypeLabel('NUMERIC')).toBe('Numérica');
    expect(getScaleTypeLabel('EVIDENCE')).toBe('Evidencia');
  });

  it('suggests a copy code and name', () => {
    expect(suggestDuplicate({ code: 'EVIDENCE_4', name: 'Evidencia 4' })).toEqual({
      code: 'EVIDENCE_4_COPIA',
      name: 'Evidencia 4 (copia)',
    });
  });

  it('trims the suggestion to the limits the server accepts', () => {
    const suggestion = suggestDuplicate({ code: 'A'.repeat(40), name: 'N'.repeat(120) });

    expect(suggestion.code.length).toBeLessThanOrEqual(40);
    expect(SCALE_CODE_PATTERN.test(suggestion.code)).toBe(true);
    expect(suggestion.name.length).toBeLessThanOrEqual(SCALE_NAME_MAX_LENGTH);
    expect(suggestion.name.endsWith('(copia)')).toBe(true);
  });
});
