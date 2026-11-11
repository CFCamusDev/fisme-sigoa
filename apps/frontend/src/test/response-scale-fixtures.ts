import type { ResponseScaleDto, ResponseScalesResponse } from '@sigoa/shared';

/** Evidencia 4 como la siembra: solo «totalmente» y «mayormente» cuentan como logro (CA2). */
export function buildEvidenceScale(overrides: Partial<ResponseScaleDto> = {}): ResponseScaleDto {
  return {
    id: 'scale-evidence',
    code: 'EVIDENCE_4',
    name: 'Evidencia en el desempeño (4)',
    type: 'EVIDENCE',
    inUse: false,
    levels: [
      { order: 1, label: 'Se evidencia totalmente', value: 4, countsAsAchievement: true },
      { order: 2, label: 'Se evidencia mayormente', value: 3, countsAsAchievement: true },
      { order: 3, label: 'Se evidencia parcialmente', value: 2, countsAsAchievement: false },
      { order: 4, label: 'No se evidencia en su desempeño', value: 1, countsAsAchievement: false },
    ],
    ...overrides,
  };
}

export function buildLikertScale(overrides: Partial<ResponseScaleDto> = {}): ResponseScaleDto {
  return {
    id: 'scale-likert',
    code: 'LIKERT_5',
    name: 'Likert de acuerdo (5)',
    type: 'LIKERT',
    inUse: false,
    levels: [
      { order: 1, label: 'Completamente de acuerdo', value: 5, countsAsAchievement: false },
      { order: 2, label: 'De acuerdo', value: 4, countsAsAchievement: false },
      { order: 3, label: 'Medianamente de acuerdo', value: 3, countsAsAchievement: false },
      { order: 4, label: 'En desacuerdo', value: 2, countsAsAchievement: false },
      { order: 5, label: 'Completamente en desacuerdo', value: 1, countsAsAchievement: false },
    ],
    ...overrides,
  };
}

export function buildNumericScale(overrides: Partial<ResponseScaleDto> = {}): ResponseScaleDto {
  return {
    id: 'scale-numeric',
    code: 'NUMERIC_1_5',
    name: 'Numérica 1–5',
    type: 'NUMERIC',
    inUse: false,
    levels: [
      { order: 1, label: '5 – Completamente de acuerdo', value: 5, countsAsAchievement: false },
      { order: 2, label: '4', value: 4, countsAsAchievement: false },
      { order: 3, label: '3', value: 3, countsAsAchievement: false },
      { order: 4, label: '2', value: 2, countsAsAchievement: false },
      { order: 5, label: '1 – Completamente en desacuerdo', value: 1, countsAsAchievement: false },
    ],
    ...overrides,
  };
}

/** Las tres escalas de origen (CA1). */
export function buildResponseScalesResponse(
  items: ResponseScaleDto[] = [buildLikertScale(), buildNumericScale(), buildEvidenceScale()],
): ResponseScalesResponse {
  return { items };
}
