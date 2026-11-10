import { describe, expect, it } from 'vitest';
import { formatEffectiveFrom, formatParameterValue } from './format-parameter-value';

describe('formatParameterValue (T-011-13, RF-011)', () => {
  it.each([
    ['UMBRAL_LOGRADO', 14, '14 / 20'],
    ['META_AG', 70, '70 %'],
    ['PESO_DIRECTA', 70, '70 %'],
    ['PESO_INDIRECTA', 30, '30 %'],
    ['MIN_PARTICIPACION', 3, '3 participantes'],
    ['MIN_PARTICIPACION', 1, '1 participante'],
    ['TOKEN_DIAS', 7, '7 días'],
    ['TOKEN_DIAS', 1, '1 día'],
    ['LOGIN_INTENTOS', 5, '5 intentos'],
    ['LOGIN_INTENTOS', 1, '1 intento'],
  ] as const)('formats %s = %d as "%s"', (key, value, expected) => {
    expect(formatParameterValue(key, value)).toBe(expected);
  });

  it('formats large values with Intl es-PE grouping', () => {
    const expected = new Intl.NumberFormat('es-PE').format(1000);
    expect(formatParameterValue('MIN_PARTICIPACION', 1000)).toBe(`${expected} participantes`);
  });
});

describe('formatEffectiveFrom', () => {
  it('shows the semester code or the default-value label', () => {
    expect(formatEffectiveFrom('2027-I')).toBe('2027-I');
    expect(formatEffectiveFrom(null)).toBe('Valor por defecto');
  });
});
