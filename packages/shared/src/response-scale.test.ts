import { describe, expect, it } from 'vitest';
import {
  createResponseScaleRequestSchema,
  duplicateResponseScaleRequestSchema,
  listResponseScalesQuerySchema,
  responseScaleDtoSchema,
  responseScaleIdParamSchema,
  responseScalesResponseSchema,
  scaleLevelInputSchema,
  updateResponseScaleRequestSchema,
} from './response-scale.js';

const level = (label: string, value: number, countsAsAchievement = false) => ({
  label,
  value,
  countsAsAchievement,
});

const valid = {
  code: 'EVIDENCE_4',
  name: 'Evidencia 4',
  type: 'EVIDENCE',
  levels: [level('No se evidencia', 1), level('Se evidencia totalmente', 4, true)],
};

describe('response scale schemas (T-012-10, RF-012)', () => {
  describe('create request', () => {
    it('accepts a valid scale', () => {
      expect(createResponseScaleRequestSchema.safeParse(valid).success).toBe(true);
    });

    it('accepts levels with the counts-as-achievement flag', () => {
      const result = createResponseScaleRequestSchema.safeParse(valid);

      expect(result.success && result.data.levels.map((l) => l.countsAsAchievement)).toEqual([
        false,
        true,
      ]);
    });

    it('accepts an incomplete but valid scale: two levels and none counting as achievement', () => {
      const result = createResponseScaleRequestSchema.safeParse({
        ...valid,
        levels: [level('A', 1), level('B', 2)],
      });

      expect(result.success).toBe(true);
    });

    it('trims code, name and labels', () => {
      const result = createResponseScaleRequestSchema.safeParse({
        ...valid,
        code: '  EVIDENCE_4 ',
        name: '  Evidencia 4  ',
        levels: [level('  A  ', 1), level(' B ', 2)],
      });

      expect(result.success && result.data.code).toBe('EVIDENCE_4');
      expect(result.success && result.data.levels[0]?.label).toBe('A');
    });

    it.each([
      ['an unknown field', { ...valid, extra: true }],
      ['a lowercase code', { ...valid, code: 'evidence' }],
      ['an empty code', { ...valid, code: '' }],
      ['a 5000-character code', { ...valid, code: 'A'.repeat(5000) }],
      ['an empty name', { ...valid, name: '  ' }],
      ['a type outside the enum', { ...valid, type: 'OTHER' }],
      ['a missing type', { code: valid.code, name: valid.name, levels: valid.levels }],
      ['one level', { ...valid, levels: [level('A', 1)] }],
      [
        'eleven levels',
        { ...valid, levels: Array.from({ length: 11 }, (_, i) => level(`N${i}`, i)) },
      ],
      ['repeated values', { ...valid, levels: [level('A', 1), level('B', 1)] }],
      [
        'repeated labels ignoring case',
        { ...valid, levels: [level('Alto', 1), level(' ALTO ', 2)] },
      ],
      ['a null levels list', { ...valid, levels: null }],
    ])('rejects %s', (_name, body) => {
      expect(createResponseScaleRequestSchema.safeParse(body).success).toBe(false);
    });
  });

  describe('level input', () => {
    it.each([
      ['a decimal value', { label: 'A', value: 13.5, countsAsAchievement: false }],
      ['a string value', { label: 'A', value: '3', countsAsAchievement: false }],
      ['a null value', { label: 'A', value: null, countsAsAchievement: false }],
      ['a negative value', { label: 'A', value: -1, countsAsAchievement: false }],
      ['a value above 100', { label: 'A', value: 101, countsAsAchievement: false }],
      ['an empty label', { label: '', value: 1, countsAsAchievement: false }],
      ['a 5000-character label', { label: 'A'.repeat(5000), value: 1, countsAsAchievement: false }],
      ['a missing flag', { label: 'A', value: 1 }],
      ['a non-boolean flag', { label: 'A', value: 1, countsAsAchievement: 'yes' }],
      [
        'an order sent by the client',
        { label: 'A', value: 1, countsAsAchievement: false, order: 1 },
      ],
    ])('rejects %s', (_name, body) => {
      expect(scaleLevelInputSchema.safeParse(body).success).toBe(false);
    });

    it('accepts the limits of the value range', () => {
      expect(scaleLevelInputSchema.safeParse(level('A', 0)).success).toBe(true);
      expect(scaleLevelInputSchema.safeParse(level('A', 100)).success).toBe(true);
    });
  });

  describe('update request', () => {
    it('accepts only a name', () => {
      expect(updateResponseScaleRequestSchema.safeParse({ name: 'Nuevo nombre' }).success).toBe(
        true,
      );
    });

    it('accepts only levels', () => {
      expect(updateResponseScaleRequestSchema.safeParse({ levels: valid.levels }).success).toBe(
        true,
      );
    });

    it.each([
      ['an empty body', {}],
      ['a code', { name: 'X', code: 'OTHER_CODE' }],
      ['a type', { name: 'X', type: 'LIKERT' }],
      ['an unknown field', { name: 'X', extra: 1 }],
      ['one level', { levels: [level('A', 1)] }],
    ])('rejects %s', (_name, body) => {
      expect(updateResponseScaleRequestSchema.safeParse(body).success).toBe(false);
    });
  });

  describe('duplicate request, query and params', () => {
    it('accepts a code and a name for the copy', () => {
      expect(
        duplicateResponseScaleRequestSchema.safeParse({ code: 'EVIDENCE_4_V2', name: 'Copia' })
          .success,
      ).toBe(true);
    });

    it('rejects a duplicate request without a name or with extra fields', () => {
      expect(duplicateResponseScaleRequestSchema.safeParse({ code: 'EVIDENCE_4_V2' }).success).toBe(
        false,
      );
      expect(
        duplicateResponseScaleRequestSchema.safeParse({ code: 'A_B', name: 'C', levels: [] })
          .success,
      ).toBe(false);
    });

    it('accepts an empty query and a type filter, and rejects the rest', () => {
      expect(listResponseScalesQuerySchema.safeParse({}).success).toBe(true);
      expect(listResponseScalesQuerySchema.safeParse({ type: 'LIKERT' }).success).toBe(true);
      expect(listResponseScalesQuerySchema.safeParse({ type: 'OTHER' }).success).toBe(false);
      expect(listResponseScalesQuerySchema.safeParse({ page: '1' }).success).toBe(false);
    });

    it('rejects an empty or 5000-character id', () => {
      expect(responseScaleIdParamSchema.safeParse({ id: 'abc123' }).success).toBe(true);
      expect(responseScaleIdParamSchema.safeParse({ id: '' }).success).toBe(false);
      expect(responseScaleIdParamSchema.safeParse({ id: 'a'.repeat(5000) }).success).toBe(false);
    });
  });

  describe('response', () => {
    const dto = {
      id: 'scale-1',
      code: 'EVIDENCE_4',
      name: 'Evidencia 4',
      type: 'EVIDENCE',
      inUse: false,
      levels: [{ order: 1, label: 'No se evidencia', value: 1, countsAsAchievement: false }],
    };

    it('accepts a scale with its levels', () => {
      expect(responseScaleDtoSchema.safeParse(dto).success).toBe(true);
      expect(responseScalesResponseSchema.safeParse({ items: [dto] }).success).toBe(true);
    });

    it('requires the in-use flag and the counts-as-achievement flag of every level', () => {
      const { inUse: _inUse, ...withoutInUse } = dto;
      const withoutFlag = {
        ...dto,
        levels: [{ order: 1, label: 'No se evidencia', value: 1 }],
      };

      expect(responseScaleDtoSchema.safeParse(withoutInUse).success).toBe(false);
      expect(responseScaleDtoSchema.safeParse(withoutFlag).success).toBe(false);
    });

    it('rejects audit fields that are not part of the contract', () => {
      expect(responseScaleDtoSchema.safeParse({ ...dto, createdBy: 'user-1' }).success).toBe(false);
    });
  });
});
