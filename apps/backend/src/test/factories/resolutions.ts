import type { PrismaClient } from '../../shared/prisma/generated/client.js';
import { createCatalogFixture, createDraftCatalogVersion } from './catalog.js';

/**
 * Crea un programa con su versión vigente y una versión En validación (la que una resolución
 * puede aprobar, HU-048). Devuelve el identificador de la versión En validación.
 */
export async function createInValidationCatalogVersion(
  prisma: PrismaClient,
  programId = 'resolution-program',
): Promise<string> {
  const fixture = await createCatalogFixture(prisma, { programId });
  return await createDraftCatalogVersion(prisma, fixture, { status: 'IN_VALIDATION' });
}

export interface RegisteredResolutionOptions {
  readonly type?: 'EDUCATIONAL_OBJECTIVE' | 'GRADUATE_ATTRIBUTE';
  readonly number?: string;
  readonly createdBy?: string;
}

/** Inserta una resolución Registrada vinculada a la versión (sin PDF ni datos de aprobación). */
export async function createRegisteredResolution(
  prisma: PrismaClient,
  catalogVersionId: string,
  options: RegisteredResolutionOptions = {},
): Promise<string> {
  const row = await prisma.resolution.create({
    data: {
      type: options.type ?? 'EDUCATIONAL_OBJECTIVE',
      number: options.number ?? 'RD-001/2027',
      issuedOn: new Date('2026-11-10T00:00:00.000Z'),
      catalogVersionId,
      createdBy: options.createdBy ?? 'SEED',
    },
  });
  return row.id;
}
