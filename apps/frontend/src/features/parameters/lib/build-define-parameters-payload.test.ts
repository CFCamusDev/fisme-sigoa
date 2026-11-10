import { describe, expect, it } from 'vitest';
import { buildParametersResponse } from '@/test/parameter-fixtures';
import { buildDefineParametersPayload, toFormValues } from './build-define-parameters-payload';

const current = buildParametersResponse('2027-I').items;

function payloadWith(changes: Record<string, string>) {
  return buildDefineParametersPayload({
    semesterCode: '2027-I',
    current,
    values: { ...toFormValues(current), ...changes },
  });
}

describe('toFormValues (T-011-13)', () => {
  it('turns the effective view into text values for the seven keys', () => {
    expect(toFormValues(current)).toEqual({
      UMBRAL_LOGRADO: '14',
      META_AG: '70',
      PESO_DIRECTA: '70',
      PESO_INDIRECTA: '30',
      MIN_PARTICIPACION: '3',
      TOKEN_DIAS: '7',
      LOGIN_INTENTOS: '5',
    });
  });
});

describe('buildDefineParametersPayload (T-011-13, D18, D4)', () => {
  it('returns null when nothing changed', () => {
    expect(payloadWith({})).toBeNull();
  });

  it('sends only the changed key when it is not a weight', () => {
    expect(payloadWith({ UMBRAL_LOGRADO: '15' })).toEqual({
      semesterCode: '2027-I',
      values: [{ key: 'UMBRAL_LOGRADO', value: 15 }],
    });
  });

  it('sends both weights when only one changes', () => {
    expect(payloadWith({ PESO_DIRECTA: '60', PESO_INDIRECTA: '30' })).toEqual({
      semesterCode: '2027-I',
      values: [
        { key: 'PESO_DIRECTA', value: 60 },
        { key: 'PESO_INDIRECTA', value: 30 },
      ],
    });
  });

  it('sends both weights when the other one changes', () => {
    const payload = payloadWith({ PESO_INDIRECTA: '40' });
    expect(payload?.values.map((v) => v.key)).toEqual(['PESO_DIRECTA', 'PESO_INDIRECTA']);
  });

  it('combines weights and another key in catalog order', () => {
    const payload = payloadWith({ TOKEN_DIAS: '10', PESO_DIRECTA: '50', PESO_INDIRECTA: '50' });
    expect(payload?.values).toEqual([
      { key: 'PESO_DIRECTA', value: 50 },
      { key: 'PESO_INDIRECTA', value: 50 },
      { key: 'TOKEN_DIAS', value: 10 },
    ]);
  });

  it('keeps a cleared field as NaN so the shared schema rejects it', () => {
    const payload = payloadWith({ META_AG: '' });
    expect(Number.isNaN(payload?.values[0]?.value)).toBe(true);
  });

  it('keeps a decimal so the shared schema rejects it', () => {
    expect(payloadWith({ UMBRAL_LOGRADO: '13.5' })?.values[0]?.value).toBe(13.5);
  });

  it('treats whitespace around a number as the same value', () => {
    expect(payloadWith({ META_AG: ' 70 ' })).toBeNull();
  });
});
