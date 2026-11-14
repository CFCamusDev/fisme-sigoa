import type { PrismaClient } from '../../../../../shared/prisma/generated/client.js';
import { OFFICIAL_TEMPLATES } from './template-seed-data.js';

const SEED_ACTOR = 'SEED';

/**
 * Seed de las plantillas oficiales (HU-018, RF-018, RN-004, RN-040). Por cada plantilla busca su
 * `code`: si existe no toca nada (respeta ediciones y versiones nuevas); si no existe crea la
 * plantilla con su versión 1 Publicada en una sola escritura. Idempotente. Agregar variables a una
 * plantilla ya sembrada se hace con una versión nueva, no con el seed.
 */
export async function seedTemplateDefaults(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<void> {
  for (const definition of OFFICIAL_TEMPLATES) {
    const existing = await prisma.template.findUnique({
      where: { code: definition.code },
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    await prisma.template.create({
      data: {
        code: definition.code,
        name: definition.name,
        type: definition.type,
        variables: definition.variables.map(({ key, label }) => ({ key, label })),
        createdBy: SEED_ACTOR,
        updatedBy: SEED_ACTOR,
        versions: {
          create: {
            number: 1,
            status: 'PUBLISHED',
            content: definition.content,
            publishedAt: now,
            publishedBy: SEED_ACTOR,
            createdBy: SEED_ACTOR,
            updatedBy: SEED_ACTOR,
          },
        },
      },
    });
  }
}
