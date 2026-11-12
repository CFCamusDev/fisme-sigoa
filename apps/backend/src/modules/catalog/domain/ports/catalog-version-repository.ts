import type { CatalogVersion } from '../entities/catalog-version.js';

export interface CatalogVersionRepository {
  /**
   * Exige transacción activa: bloquea la fila del programa (`FOR UPDATE`) para serializar las
   * altas de versiones del mismo programa.
   */
  lockProgram(programId: string): Promise<void>;
  /**
   * Inserta la cabecera de la versión. Lanza `OpenCatalogVersionExistsError` si ya hay una
   * abierta y `CatalogVersionNumberConflictError` si el número ya existe en el programa.
   */
  save(version: CatalogVersion): Promise<void>;
}
