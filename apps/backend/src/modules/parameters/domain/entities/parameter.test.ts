import { describe, expect, it } from 'vitest';
import { Parameter } from './parameter.js';
import { InvalidParameterDataError } from '../errors/index.js';

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

  it('keeps a version tied to a semester', () => {
    const parameter = Parameter.create({ ...baseProps, effectiveFromSemesterId: 'sem_2027_1' });
    expect(parameter.effectiveFromSemesterId).toBe('sem_2027_1');
  });

  it.each([
    ['UMBRAL_LOGRADO', 21],
    ['UMBRAL_LOGRADO', -1],
    ['UMBRAL_LOGRADO', 13.5],
    ['LOGIN_INTENTOS', 0],
    ['PESO_DIRECTA', 101],
  ])('rejects %s = %d', (key, value) => {
    expect(() => Parameter.create({ ...baseProps, key, value })).toThrow(InvalidParameterDataError);
  });
});
