import type { PrismaClient } from '../../../../../shared/prisma/generated/client.js';
import { PARAMETER_CATALOG, PARAMETER_KEYS } from '../../../domain/policies/parameter-catalog.js';

/**
 * Seed de los siete valores por defecto (HU-011, T-011-07, RF-011, LN sección 13).
 * Por clave: si ya existe la fila por defecto (sin semestre) no la toca, para respetar ediciones
 * futuras; si no existe, la crea. Idempotente.
 */
export async function seedParameterDefaults(prisma: PrismaClient): Promise<void> {
  for (const key of PARAMETER_KEYS) {
    const existing = await prisma.parameter.findFirst({
      where: { key, effectiveFromSemesterId: null },
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    await prisma.parameter.create({
      data: {
        key,
        value: PARAMETER_CATALOG[key].defaultValue,
        effectiveFromSemesterId: null,
        createdBy: 'SEED',
        updatedBy: 'SEED',
      },
    });
  }
}
