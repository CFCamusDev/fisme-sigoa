import { describe, expect, it } from 'vitest';
import {
  PARAMETER_DEFINITIONS,
  PARAMETER_KEYS,
  defineParametersRequestSchema,
  listParametersQuerySchema,
  parametersResponseSchema,
} from './parameter.js';

const valid = { semesterCode: '2027-I', values: [{ key: 'UMBRAL_LOGRADO', value: 15 }] };

describe('parameter schemas (T-011-08, RF-011)', () => {
  it('accepts a valid change', () => {
    expect(defineParametersRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts both weights adding up to 100', () => {
    const result = defineParametersRequestSchema.safeParse({
      semesterCode: '2027-I',
      values: [
        { key: 'PESO_DIRECTA', value: 60 },
        { key: 'PESO_INDIRECTA', value: 40 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts the seven keys together', () => {
    const result = defineParametersRequestSchema.safeParse({
      semesterCode: '2027-I',
      values: PARAMETER_KEYS.map((key) => ({
        key,
        value: PARAMETER_DEFINITIONS[key].defaultValue,
      })),
    });
    expect(result.success).toBe(true);
  });

  it('rejects weights that do not add up to 100', () => {
    const result = defineParametersRequestSchema.safeParse({
      semesterCode: '2027-I',
      values: [
        { key: 'PESO_DIRECTA', value: 70 },
        { key: 'PESO_INDIRECTA', value: 40 },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('deben sumar 100');
  });

  it('rejects a single weight', () => {
    const result = defineParametersRequestSchema.safeParse({
      semesterCode: '2027-I',
      values: [{ key: 'PESO_DIRECTA', value: 70 }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('se definen juntos');
  });

  it.each([
    ['extra field in body', { ...valid, extra: 1 }],
    ['extra field in item', { ...valid, values: [{ key: 'META_AG', value: 70, x: 1 }] }],
    ['empty values', { ...valid, values: [] }],
    [
      'eight items',
      {
        ...valid,
        values: Array.from({ length: 8 }, () => ({ key: 'META_AG', value: 70 })),
      },
    ],
    [
      'repeated keys',
      {
        ...valid,
        values: [
          { key: 'META_AG', value: 70 },
          { key: 'META_AG', value: 80 },
        ],
      },
    ],
    ['key outside catalog', { ...valid, values: [{ key: 'OTRA', value: 1 }] }],
    ['lowercase key', { ...valid, values: [{ key: 'meta_ag', value: 1 }] }],
    ['decimal', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: 13.5 }] }],
    ['string value', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: '14' }] }],
    ['null value', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: null }] }],
    ['negative', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: -1 }] }],
    ['above range', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: 21 }] }],
    ['weight above 100', { ...valid, values: [{ key: 'META_AG', value: 101 }] }],
    ['NaN', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: Number.NaN }] }],
    [
      'Infinity',
      { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: Number.POSITIVE_INFINITY }] },
    ],
    ['invalid semester', { ...valid, semesterCode: '2027-III' }],
    ['empty semester', { ...valid, semesterCode: '' }],
    ['huge semester', { ...valid, semesterCode: 'x'.repeat(5000) }],
    ['missing semester', { values: valid.values }],
    ['values not an array', { ...valid, values: 'x' }],
  ])('rejects %s', (_name, input) => {
    expect(defineParametersRequestSchema.safeParse(input).success).toBe(false);
  });

  it('validates the list query strictly', () => {
    expect(listParametersQuerySchema.safeParse({}).success).toBe(true);
    expect(listParametersQuerySchema.safeParse({ semesterCode: '2027-I' }).success).toBe(true);
    expect(listParametersQuerySchema.safeParse({ semesterCode: '2027-III' }).success).toBe(false);
    expect(listParametersQuerySchema.safeParse({ semesterCode: '' }).success).toBe(false);
    expect(listParametersQuerySchema.safeParse({ other: 1 }).success).toBe(false);
  });

  it('parses a response with a null semester and unknown-free items', () => {
    const response = {
      semesterCode: null,
      items: [
        {
          key: 'META_AG',
          label: 'Meta por atributo del graduado',
          unit: 'PERCENT',
          value: 70,
          effectiveFromSemesterCode: null,
          versions: [{ value: 70, effectiveFromSemesterCode: null, effectiveToSemesterCode: null }],
        },
      ],
    };
    expect(parametersResponseSchema.safeParse(response).success).toBe(true);
    expect(parametersResponseSchema.safeParse({ ...response, extra: 1 }).success).toBe(false);
  });

  it('keeps the default weights adding up to 100', () => {
    expect(
      PARAMETER_DEFINITIONS.PESO_DIRECTA.defaultValue +
        PARAMETER_DEFINITIONS.PESO_INDIRECTA.defaultValue,
    ).toBe(100);
  });
});
