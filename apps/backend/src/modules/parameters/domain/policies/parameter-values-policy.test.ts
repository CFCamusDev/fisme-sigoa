import { describe, expect, it } from 'vitest';
import { InvalidParameterDataError } from '../errors/index.js';
import { assertValidParameterChange } from './parameter-values-policy.js';

describe('assertValidParameterChange (T-011-14, RF-011)', () => {
  it('accepts a single non-weight key within range', () => {
    expect(() => assertValidParameterChange([{ key: 'UMBRAL_LOGRADO', value: 15 }])).not.toThrow();
  });

  it('accepts the seven default values together', () => {
    expect(() =>
      assertValidParameterChange([
        { key: 'UMBRAL_LOGRADO', value: 14 },
        { key: 'META_AG', value: 70 },
        { key: 'PESO_DIRECTA', value: 70 },
        { key: 'PESO_INDIRECTA', value: 30 },
        { key: 'MIN_PARTICIPACION', value: 3 },
        { key: 'TOKEN_DIAS', value: 7 },
        { key: 'LOGIN_INTENTOS', value: 5 },
      ]),
    ).not.toThrow();
  });

  it('accepts both weights when they add up to 100', () => {
    expect(() =>
      assertValidParameterChange([
        { key: 'PESO_DIRECTA', value: 60 },
        { key: 'PESO_INDIRECTA', value: 40 },
      ]),
    ).not.toThrow();
  });

  it('rejects weights that do not add up to 100', () => {
    expect(() =>
      assertValidParameterChange([
        { key: 'PESO_DIRECTA', value: 70 },
        { key: 'PESO_INDIRECTA', value: 40 },
      ]),
    ).toThrow('deben sumar 100');
  });

  it.each(['PESO_DIRECTA', 'PESO_INDIRECTA'])('rejects %s sent without its pair', (key) => {
    expect(() => assertValidParameterChange([{ key, value: 50 }])).toThrow(
      'se definen juntos y deben sumar 100',
    );
  });

  it('rejects an empty change', () => {
    expect(() => assertValidParameterChange([])).toThrow('al menos un parámetro');
  });

  it('rejects repeated keys', () => {
    expect(() =>
      assertValidParameterChange([
        { key: 'META_AG', value: 70 },
        { key: 'META_AG', value: 75 },
      ]),
    ).toThrow('META_AG está repetida');
  });

  it.each(['OTRA', 'umbral_logrado', '', 'constructor', '__proto__'])(
    'rejects the key %j outside the catalog',
    (key) => {
      expect(() => assertValidParameterChange([{ key, value: 1 }])).toThrow(
        InvalidParameterDataError,
      );
    },
  );

  it.each([
    ['UMBRAL_LOGRADO', -1],
    ['UMBRAL_LOGRADO', 21],
    ['META_AG', 101],
    ['PESO_DIRECTA', 101],
    ['MIN_PARTICIPACION', 0],
    ['MIN_PARTICIPACION', 1001],
    ['TOKEN_DIAS', 0],
    ['TOKEN_DIAS', 366],
    ['LOGIN_INTENTOS', 0],
    ['LOGIN_INTENTOS', 21],
  ])('rejects %s = %d out of range', (key, value) => {
    expect(() => assertValidParameterChange([{ key, value }])).toThrow(InvalidParameterDataError);
  });

  it('accepts the range boundaries', () => {
    expect(() =>
      assertValidParameterChange([
        { key: 'UMBRAL_LOGRADO', value: 0 },
        { key: 'MIN_PARTICIPACION', value: 1000 },
        { key: 'TOKEN_DIAS', value: 365 },
        { key: 'LOGIN_INTENTOS', value: 20 },
      ]),
    ).not.toThrow();
  });

  it.each([13.5, Number.NaN, Number.POSITIVE_INFINITY, '14', null, undefined])(
    'rejects the non-integer value %j',
    (value) => {
      expect(() =>
        assertValidParameterChange([{ key: 'UMBRAL_LOGRADO', value: value as unknown as number }]),
      ).toThrow(InvalidParameterDataError);
    },
  );

  it('reports the expected range in Spanish', () => {
    expect(() => assertValidParameterChange([{ key: 'UMBRAL_LOGRADO', value: 21 }])).toThrow(
      'El valor de UMBRAL_LOGRADO debe ser un número entero entre 0 y 20.',
    );
  });
});
