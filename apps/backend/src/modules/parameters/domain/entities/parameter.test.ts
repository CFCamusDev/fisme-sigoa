import { describe, expect, it } from 'vitest';
import { Parameter } from './parameter.js';
import { InvalidParameterDataError } from '../errors/index.js';
import { assertValidParameterChange } from '../policies/parameter-values-policy.js';

describe('Parameter entity and values policy (T-011-02, RF-011)', () => {
  const baseProps = {
    id: 'par_1',
    key: 'UMBRAL_LOGRADO',
    value: 14,
    effectiveFromSemesterId: null,
    createdBy: 'SEED',
    updatedBy: 'SEED',
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
  };

  it('creates a parameter version for a catalog key within range', () => {
    const parameter = Parameter.create(baseProps);
    expect(parameter.key).toBe('UMBRAL_LOGRADO');
    expect(parameter.value).toBe(14);
    expect(parameter.effectiveFromSemesterId).toBeNull();
  });

  it('rejects a key outside the catalog', () => {
    expect(() => Parameter.create({ ...baseProps, key: 'OTRA_CLAVE' })).toThrow(
      InvalidParameterDataError,
    );
  });

  it('rejects weights that do not add up to 100', () => {
    expect(() =>
      assertValidParameterChange([
        { key: 'PESO_DIRECTA', value: 70 },
        { key: 'PESO_INDIRECTA', value: 40 },
      ]),
    ).toThrow(InvalidParameterDataError);
  });
});
