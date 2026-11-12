import {
  SCALE_CODE_PATTERN,
  SCALE_LABEL_MAX_LENGTH,
  SCALE_MAX_LEVELS,
  SCALE_MAX_VALUE,
  SCALE_MIN_LEVELS,
  SCALE_MIN_VALUE,
  SCALE_NAME_MAX_LENGTH,
  SCALE_TYPES,
  createResponseScaleRequestSchema,
} from '@sigoa/shared';
import { describe, expect, it } from 'vitest';
import {
  RESPONSE_SCALE_LIMITS,
  ResponseScale,
  SCALE_TYPES as DOMAIN_SCALE_TYPES,
} from './response-scale.js';

/** El dominio no importa `@sigoa/shared` (AGENTS §4.1); esta prueba evita que los límites diverjan. */
describe('response scale limits: domain and @sigoa/shared agree (T-012-10)', () => {
  it('uses the same constants', () => {
    expect(RESPONSE_SCALE_LIMITS.codeRegex.source).toBe(SCALE_CODE_PATTERN.source);
    expect(RESPONSE_SCALE_LIMITS.nameMaxLength).toBe(SCALE_NAME_MAX_LENGTH);
    expect(RESPONSE_SCALE_LIMITS.labelMaxLength).toBe(SCALE_LABEL_MAX_LENGTH);
    expect(RESPONSE_SCALE_LIMITS.minLevels).toBe(SCALE_MIN_LEVELS);
    expect(RESPONSE_SCALE_LIMITS.maxLevels).toBe(SCALE_MAX_LEVELS);
    expect(RESPONSE_SCALE_LIMITS.minValue).toBe(SCALE_MIN_VALUE);
    expect(RESPONSE_SCALE_LIMITS.maxValue).toBe(SCALE_MAX_VALUE);
    expect([...DOMAIN_SCALE_TYPES]).toEqual([...SCALE_TYPES]);
  });

  const levelsOf = (count: number, from = 0) =>
    Array.from({ length: count }, (_, index) => ({
      label: `Nivel ${index}`,
      value: from + index,
      countsAsAchievement: false,
    }));

  const cases: Array<
    [string, { code: string; name: string; levels: ReturnType<typeof levelsOf> }]
  > = [
    ['a valid scale', { code: 'LIKERT_5', name: 'Likert 5', levels: levelsOf(5) }],
    [
      'the minimum number of levels',
      { code: 'AB', name: 'Mínima', levels: levelsOf(SCALE_MIN_LEVELS) },
    ],
    [
      'the maximum number of levels',
      { code: 'MAX_10', name: 'Máxima', levels: levelsOf(SCALE_MAX_LEVELS) },
    ],
    ['too few levels', { code: 'AB', name: 'Pocas', levels: levelsOf(SCALE_MIN_LEVELS - 1) }],
    ['too many levels', { code: 'AB', name: 'Muchas', levels: levelsOf(SCALE_MAX_LEVELS + 1) }],
    [
      'the largest allowed value',
      { code: 'AB', name: 'Tope', levels: levelsOf(2, SCALE_MAX_VALUE - 1) },
    ],
    [
      'a value above the range',
      { code: 'AB', name: 'Fuera', levels: levelsOf(2, SCALE_MAX_VALUE) },
    ],
    ['a lowercase code', { code: 'ab', name: 'Código', levels: levelsOf(2) }],
    [
      'the longest allowed name',
      { code: 'AB', name: 'N'.repeat(SCALE_NAME_MAX_LENGTH), levels: levelsOf(2) },
    ],
    [
      'a name that is too long',
      { code: 'AB', name: 'N'.repeat(SCALE_NAME_MAX_LENGTH + 1), levels: levelsOf(2) },
    ],
  ];

  it.each(cases)('accepts or rejects %s in the same way', (_name, input) => {
    const shared = createResponseScaleRequestSchema.safeParse({ ...input, type: 'LIKERT' }).success;

    let domain = true;
    try {
      ResponseScale.create({
        id: 'scale-1',
        code: input.code,
        name: input.name,
        type: 'LIKERT',
        levels: input.levels.map((level, index) => ({ ...level, order: index + 1 })),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch {
      domain = false;
    }

    expect(domain).toBe(shared);
  });
});
