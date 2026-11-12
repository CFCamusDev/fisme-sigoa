import type { PrismaClient } from '../../../../../shared/prisma/generated/client.js';
import { SEED_ATTRIBUTES, SEED_OBJECTIVES } from './catalog-seed-data.js';

/**
 * Seed de la versión 1 vigente del catálogo (HU-013, RF-013, RN-020).
 * Toma el primer programa; si ya tiene cualquier versión no toca nada (respeta ediciones y evita
 * chocar con el índice de versiones abiertas). Si no, crea la versión 1 aprobada con sus 4 OE y
 * 12 AG en una sola operación. Idempotente. La vinculación con la resolución queda para la HU de
 * resoluciones (RN-021).
 */
export async function seedCatalogVersionDefaults(prisma: PrismaClient): Promise<void> {
  const program = await prisma.program.findFirst({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (!program) {
    throw new Error(
      'No hay un programa de estudios: el seed del catálogo corre después de parameters-program-epis.',
    );
  }

  const existing = await prisma.catalogVersion.findFirst({
    where: { programId: program.id },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  await prisma.catalogVersion.create({
    data: {
      programId: program.id,
      number: 1,
      status: 'APPROVED',
      createdBy: 'SEED',
      updatedBy: 'SEED',
      objectives: {
        create: SEED_OBJECTIVES.map((item, index) => ({
          code: item.code,
          statement: item.statement,
          order: index + 1,
          createdBy: 'SEED',
          updatedBy: 'SEED',
        })),
      },
      attributes: {
        create: SEED_ATTRIBUTES.map((item, index) => ({
          code: item.code,
          name: item.name,
          statement: item.statement,
          order: index + 1,
          createdBy: 'SEED',
          updatedBy: 'SEED',
        })),
      },
    },
  });
}
