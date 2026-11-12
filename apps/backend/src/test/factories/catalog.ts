import type { PrismaClient } from '../../shared/prisma/generated/client.js';

export interface CatalogFixtureOptions {
  /** Identificador del programa; por defecto `catalog-program`. */
  programId?: string;
  /** Si es `false` solo crea el programa (sin versión vigente). Por defecto `true`. */
  withCurrentVersion?: boolean;
  objectiveCount?: number;
  attributeCount?: number;
}

export interface CatalogFixture {
  programId: string;
  /** Identificador de la versión 1 aprobada, o `null` si no se creó. */
  currentVersionId: string | null;
}

/**
 * Datos mínimos del catálogo para pruebas: un programa y, opcionalmente, la versión 1 aprobada con
 * sus OE (`OEP1…`) y AG (`AG-C01…`). Cada prueba crea los suyos (corren en paralelo, HU-078).
 */
export async function createCatalogFixture(
  prisma: PrismaClient,
  options: CatalogFixtureOptions = {},
): Promise<CatalogFixture> {
  const programId = options.programId ?? 'catalog-program';
  const objectiveCount = options.objectiveCount ?? 4;
  const attributeCount = options.attributeCount ?? 12;

  await prisma.program.create({
    data: {
      id: programId,
      code: `EPIS-${programId}`,
      name: 'Programa de prueba',
      faculty: 'FISME',
    },
  });

  if (options.withCurrentVersion === false) {
    return { programId, currentVersionId: null };
  }

  const version = await prisma.catalogVersion.create({
    data: {
      programId,
      number: 1,
      status: 'APPROVED',
      createdBy: 'SEED',
      updatedBy: 'SEED',
      objectives: {
        create: Array.from({ length: objectiveCount }, (_, index) => ({
          code: `OEP${index + 1}`,
          statement: `Enunciado del objetivo ${index + 1}.`,
          order: index + 1,
        })),
      },
      attributes: {
        create: Array.from({ length: attributeCount }, (_, index) => ({
          code: `AG-C${String(index + 1).padStart(2, '0')}`,
          name: `Atributo ${index + 1}`,
          statement: `Enunciado del atributo ${index + 1}.`,
          order: index + 1,
        })),
      },
    },
  });

  return { programId, currentVersionId: version.id };
}
