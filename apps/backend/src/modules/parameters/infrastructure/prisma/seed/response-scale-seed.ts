import type { PrismaClient } from '../../../../../shared/prisma/generated/client.js';
import type { ScaleLevelInput, ScaleType } from '../../../domain/entities/response-scale.js';

export interface DefaultResponseScale {
  readonly code: string;
  readonly name: string;
  readonly type: ScaleType;
  readonly levels: readonly ScaleLevelInput[];
}

const level = (label: string, value: number, countsAsAchievement = false): ScaleLevelInput => ({
  label,
  value,
  countsAsAchievement,
});

/**
 * Catálogo de origen de escalas (RN-052, LN sección 7.2), del mejor al peor nivel.
 * Solo «Se evidencia totalmente» y «mayormente» cuentan como logro (RN-085, CA2).
 */
export const DEFAULT_RESPONSE_SCALES: readonly DefaultResponseScale[] = [
  {
    code: 'LIKERT_5',
    name: 'Likert de acuerdo (5)',
    type: 'LIKERT',
    levels: [
      level('Completamente de acuerdo', 5),
      level('De acuerdo', 4),
      level('Medianamente de acuerdo', 3),
      level('En desacuerdo', 2),
      level('Completamente en desacuerdo', 1),
    ],
  },
  {
    code: 'NUMERIC_1_5',
    name: 'Numérica 1–5',
    type: 'NUMERIC',
    levels: [
      level('5 – Completamente de acuerdo', 5),
      level('4', 4),
      level('3', 3),
      level('2', 2),
      level('1 – Completamente en desacuerdo', 1),
    ],
  },
  {
    code: 'EVIDENCE_4',
    name: 'Evidencia en el desempeño (4)',
    type: 'EVIDENCE',
    levels: [
      level('Se evidencia totalmente', 4, true),
      level('Se evidencia mayormente', 3, true),
      level('Se evidencia parcialmente', 2),
      level('No se evidencia en su desempeño', 1),
    ],
  },
];

/**
 * Seed de las tres escalas de origen (HU-012, T-012-09, RF-012, CA1, CA2).
 * Por código: si la escala ya existe no la toca, para respetar ediciones; si no, la crea con sus
 * niveles en una sola operación. Idempotente.
 */
export async function seedResponseScaleDefaults(prisma: PrismaClient): Promise<void> {
  for (const scale of DEFAULT_RESPONSE_SCALES) {
    const existing = await prisma.responseScale.findUnique({
      where: { code: scale.code },
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    await prisma.responseScale.create({
      data: {
        code: scale.code,
        name: scale.name,
        type: scale.type,
        createdBy: 'SEED',
        updatedBy: 'SEED',
        levels: {
          create: scale.levels.map((item, index) => ({
            order: index + 1,
            label: item.label,
            value: item.value,
            countsAsAchievement: item.countsAsAchievement,
          })),
        },
      },
    });
  }
}
