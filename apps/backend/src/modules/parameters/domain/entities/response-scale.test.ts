import { describe, expect, it } from 'vitest';
import { ResponseScale, type ScaleLevel } from './response-scale.js';
import { InvalidResponseScaleDataError } from '../errors/invalid-response-scale-data-error.js';
import { ResponseScaleInUseError } from '../errors/response-scale-in-use-error.js';
import { assertScaleEditable } from '../policies/response-scale-editing-policy.js';

const levels: ScaleLevel[] = [
  { order: 1, label: 'Nada', value: 1, countsAsAchievement: false },
  { order: 2, label: 'Mucho', value: 2, countsAsAchievement: true },
];

const baseProps = {
  id: 'scale-1',
  code: 'EVIDENCE_4',
  name: 'Evidencia 4',
  type: 'EVIDENCE' as const,
  levels,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('ResponseScale (minimal TDD, completed in T-012-18)', () => {
  it('keeps the counts-as-achievement flag per level', () => {
    const scale = ResponseScale.create(baseProps);

    expect(scale.levels.map((level) => level.countsAsAchievement)).toEqual([false, true]);
  });

  it('rejects editing a scale that is in use', () => {
    const scale = ResponseScale.create(baseProps);

    expect(() => assertScaleEditable({ scale, inUse: true })).toThrow(ResponseScaleInUseError);
    expect(() => assertScaleEditable({ scale, inUse: false })).not.toThrow();
  });

  it('rejects a single level', () => {
    expect(() => ResponseScale.create({ ...baseProps, levels: [levels[0]!] })).toThrow(
      InvalidResponseScaleDataError,
    );
  });
});
