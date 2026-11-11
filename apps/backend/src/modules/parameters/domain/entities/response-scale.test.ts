import { describe, expect, it } from 'vitest';
import {
  RESPONSE_SCALE_LIMITS,
  ResponseScale,
  type ResponseScaleProperties,
  type ScaleLevel,
  type ScaleLevelInput,
} from './response-scale.js';
import { InvalidResponseScaleDataError } from '../errors/invalid-response-scale-data-error.js';
import { ResponseScaleInUseError } from '../errors/response-scale-in-use-error.js';
import { assertScaleEditable } from '../policies/response-scale-editing-policy.js';

const evidenceLevels: ScaleLevel[] = [
  { order: 1, label: 'No se evidencia', value: 1, countsAsAchievement: false },
  { order: 2, label: 'Se evidencia poco', value: 2, countsAsAchievement: false },
  { order: 3, label: 'Se evidencia mayormente', value: 3, countsAsAchievement: true },
  { order: 4, label: 'Se evidencia totalmente', value: 4, countsAsAchievement: true },
];

const baseProps: ResponseScaleProperties = {
  id: 'scale-1',
  code: 'EVIDENCE_4',
  name: 'Evidencia 4',
  type: 'EVIDENCE',
  levels: evidenceLevels,
  createdBy: 'user-admin',
  updatedBy: 'user-admin',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function levelsOf(count: number): ScaleLevel[] {
  return Array.from({ length: count }, (_, index) => ({
    order: index + 1,
    label: `Nivel ${index + 1}`,
    value: index + 1,
    countsAsAchievement: false,
  }));
}

function createWith(overrides: Partial<ResponseScaleProperties>): ResponseScale {
  return ResponseScale.create({ ...baseProps, ...overrides });
}

describe('ResponseScale entity (domain)', () => {
  describe('creation', () => {
    it('creates a valid scale and trims text fields', () => {
      const scale = createWith({ code: '  EVIDENCE_4  ', name: '  Evidencia 4  ' });

      expect(scale.id).toBe('scale-1');
      expect(scale.code).toBe('EVIDENCE_4');
      expect(scale.name).toBe('Evidencia 4');
      expect(scale.type).toBe('EVIDENCE');
      expect(scale.levels).toHaveLength(4);
    });

    it('accepts the smallest valid scale with two levels and no achievement level', () => {
      const scale = createWith({ levels: levelsOf(2) });

      expect(scale.levels.some((level) => level.countsAsAchievement)).toBe(false);
    });

    it('accepts the largest valid scale with ten levels', () => {
      expect(createWith({ levels: levelsOf(10) }).levels).toHaveLength(10);
    });

    it.each([
      ['empty', ''],
      ['lowercase', 'evidence_4'],
      ['starting with a digit', '4_EVIDENCE'],
      ['a single character', 'E'],
      ['with spaces', 'EVIDENCE 4'],
      ['too long', 'A'.repeat(41)],
    ])('rejects a code that is %s', (_name, code) => {
      expect(() => createWith({ code })).toThrow(InvalidResponseScaleDataError);
    });

    it('rejects an empty or too long name', () => {
      expect(() => createWith({ name: '   ' })).toThrow(InvalidResponseScaleDataError);
      expect(() =>
        createWith({ name: 'N'.repeat(RESPONSE_SCALE_LIMITS.nameMaxLength + 1) }),
      ).toThrow(InvalidResponseScaleDataError);
    });

    it('rejects a type outside the closed list', () => {
      expect(() =>
        createWith({ type: 'OTHER' as unknown as ResponseScaleProperties['type'] }),
      ).toThrow(InvalidResponseScaleDataError);
    });
  });

  describe('levels', () => {
    it.each([
      ['no levels', 0],
      ['one level', 1],
      ['eleven levels', 11],
    ])('rejects a scale with %s', (_name, count) => {
      expect(() => createWith({ levels: levelsOf(count) })).toThrow(InvalidResponseScaleDataError);
    });

    it('rejects levels whose order is not consecutive from 1', () => {
      const gap = levelsOf(3).map((level, index) => ({
        ...level,
        order: index === 2 ? 4 : level.order,
      }));
      const startsAtZero = levelsOf(2).map((level) => ({ ...level, order: level.order - 1 }));

      expect(() => createWith({ levels: gap })).toThrow(/consecutivo/);
      expect(() => createWith({ levels: startsAtZero })).toThrow(/consecutivo/);
    });

    it('rejects repeated values', () => {
      const levels = levelsOf(3).map((level) => ({ ...level, value: 5 }));

      expect(() => createWith({ levels })).toThrow(/valores/);
    });

    it('rejects repeated labels ignoring case and surrounding spaces', () => {
      const levels = levelsOf(2).map((level, index) => ({
        ...level,
        label: index === 0 ? 'Totalmente' : '  TOTALMENTE ',
      }));

      expect(() => createWith({ levels })).toThrow(/etiquetas/);
    });

    it.each([
      ['below the range', -1],
      ['above the range', 101],
      ['a decimal', 3.5],
      ['not a number', Number.NaN],
    ])('rejects a value that is %s', (_name, value) => {
      const levels = levelsOf(2).map((level, index) => (index === 0 ? { ...level, value } : level));

      expect(() => createWith({ levels })).toThrow(InvalidResponseScaleDataError);
    });

    it('accepts the limits of the value range', () => {
      const levels = levelsOf(2).map((level, index) => ({
        ...level,
        value: index === 0 ? 0 : 100,
      }));

      expect(createWith({ levels }).levels.map((level) => level.value)).toEqual([0, 100]);
    });

    it('rejects empty or too long labels', () => {
      const empty = levelsOf(2).map((level, index) =>
        index === 0 ? { ...level, label: ' ' } : level,
      );
      const long = levelsOf(2).map((level, index) =>
        index === 0
          ? { ...level, label: 'L'.repeat(RESPONSE_SCALE_LIMITS.labelMaxLength + 1) }
          : level,
      );

      expect(() => createWith({ levels: empty })).toThrow(InvalidResponseScaleDataError);
      expect(() => createWith({ levels: long })).toThrow(InvalidResponseScaleDataError);
    });

    it('rejects a counts-as-achievement flag that is not a boolean', () => {
      const levels = levelsOf(2).map((level, index) =>
        index === 0 ? ({ ...level, countsAsAchievement: 'yes' } as unknown as ScaleLevel) : level,
      );

      expect(() => createWith({ levels })).toThrow(/cuenta como logro/);
    });

    it('keeps the counts-as-achievement flag per level', () => {
      const scale = createWith({});

      expect(scale.levels.map((level) => level.countsAsAchievement)).toEqual([
        false,
        false,
        true,
        true,
      ]);
    });

    it('assigns consecutive order from the position when building levels from inputs', () => {
      const inputs: ScaleLevelInput[] = [
        { label: 'A', value: 10, countsAsAchievement: false },
        { label: 'B', value: 20, countsAsAchievement: true },
      ];

      expect(ResponseScale.levelsFromInputs(inputs).map((level) => level.order)).toEqual([1, 2]);
    });
  });

  describe('changes', () => {
    it('renames the scale and records who and when', () => {
      const scale = createWith({});

      scale.rename('  Evidencia renombrada ', 'user-editor');

      expect(scale.name).toBe('Evidencia renombrada');
      expect(scale.updatedBy).toBe('user-editor');
      expect(scale.updatedAt.getTime()).toBeGreaterThan(baseProps.updatedAt.getTime());
    });

    it('rejects an invalid new name and keeps the old one', () => {
      const scale = createWith({});

      expect(() => scale.rename('  ')).toThrow(InvalidResponseScaleDataError);
      expect(scale.name).toBe('Evidencia 4');
    });

    it('replaces the levels deriving the order from the position', () => {
      const scale = createWith({});

      scale.replaceLevels(
        [
          { label: 'No', value: 0, countsAsAchievement: false },
          { label: 'Sí', value: 100, countsAsAchievement: true },
        ],
        'user-editor',
      );

      expect(scale.levels).toEqual([
        { order: 1, label: 'No', value: 0, countsAsAchievement: false },
        { order: 2, label: 'Sí', value: 100, countsAsAchievement: true },
      ]);
      expect(scale.updatedBy).toBe('user-editor');
    });

    it('keeps the previous levels when the replacement is invalid', () => {
      const scale = createWith({});

      expect(() =>
        scale.replaceLevels([{ label: 'Solo uno', value: 1, countsAsAchievement: false }]),
      ).toThrow(InvalidResponseScaleDataError);
      expect(scale.levels).toHaveLength(4);
    });

    it('returns a snapshot that later changes do not alter', () => {
      const scale = createWith({});
      const before = scale.snapshot();

      scale.rename('Otro nombre');
      scale.replaceLevels([
        { label: 'A', value: 1, countsAsAchievement: false },
        { label: 'B', value: 2, countsAsAchievement: true },
      ]);

      expect(before.name).toBe('Evidencia 4');
      expect(before.levels).toHaveLength(4);
      expect(scale.snapshot().levels).toHaveLength(2);
    });
  });

  describe('duplication', () => {
    it('copies the levels into a new scale with another code and the same type', () => {
      const original = createWith({});
      const now = new Date('2026-03-01T00:00:00.000Z');

      const copy = original.duplicate(
        'scale-2',
        'EVIDENCE_4_V2',
        'Evidencia 4 (v2)',
        'user-editor',
        now,
      );

      expect(copy.id).toBe('scale-2');
      expect(copy.code).toBe('EVIDENCE_4_V2');
      expect(copy.name).toBe('Evidencia 4 (v2)');
      expect(copy.type).toBe('EVIDENCE');
      expect(copy.levels).toEqual(original.levels);
      expect(copy.createdBy).toBe('user-editor');
      expect(copy.createdAt).toEqual(now);
    });

    it('does not share state with the original scale', () => {
      const original = createWith({});
      const copy = original.duplicate('scale-2', 'EVIDENCE_4_V2', 'Copia');

      copy.replaceLevels([
        { label: 'A', value: 1, countsAsAchievement: false },
        { label: 'B', value: 2, countsAsAchievement: true },
      ]);

      expect(original.levels).toHaveLength(4);
    });

    it('rejects an invalid code for the copy', () => {
      expect(() => createWith({}).duplicate('scale-2', 'minuscula', 'Copia')).toThrow(
        InvalidResponseScaleDataError,
      );
    });
  });

  describe('editing policy', () => {
    it('rejects editing a scale that is in use', () => {
      const scale = createWith({});

      expect(() => assertScaleEditable({ scale, inUse: true })).toThrow(ResponseScaleInUseError);
      expect(() => assertScaleEditable({ scale, inUse: true })).toThrow(/Duplícala/);
    });

    it('allows editing a scale that is not in use', () => {
      expect(() => assertScaleEditable({ scale: createWith({}), inUse: false })).not.toThrow();
    });
  });
});
