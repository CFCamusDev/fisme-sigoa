import { describe, expect, it } from 'vitest';
import { ResponseScale } from '../../../domain/entities/response-scale.js';
import { DEFAULT_RESPONSE_SCALES } from './response-scale-seed.js';

describe('default response scales (T-012-09, RN-052, RN-085, CA1, CA2)', () => {
  it('has the three scales of the catalog', () => {
    expect(DEFAULT_RESPONSE_SCALES.map((scale) => [scale.code, scale.type])).toEqual([
      ['LIKERT_5', 'LIKERT'],
      ['NUMERIC_1_5', 'NUMERIC'],
      ['EVIDENCE_4', 'EVIDENCE'],
    ]);
  });

  it.each(DEFAULT_RESPONSE_SCALES.map((scale) => [scale.code, scale] as const))(
    'builds %s with the domain rules',
    (_code, scale) => {
      const built = ResponseScale.create({
        id: scale.code,
        code: scale.code,
        name: scale.name,
        type: scale.type,
        levels: ResponseScale.levelsFromInputs(scale.levels),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(built.levels.length).toBe(scale.levels.length);
    },
  );

  it('has 5, 5 and 4 levels', () => {
    expect(DEFAULT_RESPONSE_SCALES.map((scale) => scale.levels.length)).toEqual([5, 5, 4]);
  });

  it('marks only totally and mostly as counting toward achievement (CA2)', () => {
    const counting = DEFAULT_RESPONSE_SCALES.flatMap((scale) =>
      scale.levels
        .filter((item) => item.countsAsAchievement)
        .map((item) => `${scale.code}:${item.label}`),
    );

    expect(counting).toEqual([
      'EVIDENCE_4:Se evidencia totalmente',
      'EVIDENCE_4:Se evidencia mayormente',
    ]);
  });
});
