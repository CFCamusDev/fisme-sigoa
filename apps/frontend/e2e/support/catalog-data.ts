import { getWorkerSeeder } from './seeder';

/**
 * Deja la base del worker sin versiones del catálogo. Las pruebas comparten la base de su worker:
 * quien siembra catálogo lo limpia al terminar para no alterar el estado vacío que otras esperan.
 */
export async function resetCatalog(): Promise<void> {
  await getWorkerSeeder().resetCatalog();
}

/** Siembra la versión 1 vigente (4 OE y 12 AG oficiales) en el programa que ya existe. */
export async function seedCurrentCatalog(): Promise<void> {
  await getWorkerSeeder().seedCurrentCatalog();
}

/**
 * Siembra la versión 2 En validación (copia de la vigente, sin textos propios) sobre la versión 1
 * vigente: es a la que se puede vincular una resolución (HU-048, RS 5.3). Exige `seedCurrentCatalog`.
 */
export async function seedInValidationCatalogVersion(): Promise<void> {
  await getWorkerSeeder().seedInValidationCatalogVersion();
}

/** Deja la base del worker sin resoluciones ni sus PDF (no toca el catálogo). */
export async function resetResolutions(): Promise<void> {
  await getWorkerSeeder().resetResolutions();
}

/** Siembra una resolución de OE para la versión En validación, Registrada o Aprobada con su PDF. */
export async function seedResolution(options: {
  number: string;
  status: 'REGISTERED' | 'APPROVED';
}): Promise<void> {
  await getWorkerSeeder().seedResolution(options);
}

/**
 * Convierte la versión 1 vigente en Histórica y siembra la versión 2 vigente con un OE ampliado y
 * otro quitado, cada una con su resolución de OE aprobada (HU-017). Exige `seedCurrentCatalog`.
 */
export async function seedHistoricalCatalog(): Promise<void> {
  await getWorkerSeeder().seedHistoricalCatalog();
}
