import { responseScaleDtoSchema } from '@sigoa/shared';
import { describe, expect, it } from 'vitest';
import { ResponseScale } from '../domain/entities/response-scale.js';
import { buildResponseScaleDto, mapResponseScaleToDto } from './response-scale-dto.js';

const scale = ResponseScale.create({
  id: 'scale-1',
  code: 'EVIDENCE_4',
  name: 'Evidencia 4',
  type: 'EVIDENCE',
  levels: [
    { order: 1, label: 'Nada', value: 1, countsAsAchievement: false },
    { order: 2, label: 'Todo', value: 2, countsAsAchievement: true },
  ],
  createdBy: 'admin-1',
  updatedBy: 'admin-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

describe('response scale DTO (T-012-06, D22)', () => {
  it('maps every level with its counts-as-achievement flag and the in-use flag', () => {
    const dto = mapResponseScaleToDto(scale, true);

    expect(dto.inUse).toBe(true);
    expect(dto.levels).toEqual([
      { order: 1, label: 'Nada', value: 1, countsAsAchievement: false },
      { order: 2, label: 'Todo', value: 2, countsAsAchievement: true },
    ]);
  });

  it('produces a DTO that matches the shared contract', () => {
    const dto = buildResponseScaleDto(scale, false);

    expect(responseScaleDtoSchema.safeParse(dto).success).toBe(true);
  });

  it('does not expose audit fields', () => {
    expect(Object.keys(mapResponseScaleToDto(scale, false)).sort()).toEqual([
      'code',
      'id',
      'inUse',
      'levels',
      'name',
      'type',
    ]);
  });
});
