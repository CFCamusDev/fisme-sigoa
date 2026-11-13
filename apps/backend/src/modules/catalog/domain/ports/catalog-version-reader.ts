import type { CatalogVersion } from '../entities/catalog-version.js';

export interface CatalogVersionReader {
  /** Versiones del programa, de la más reciente (número mayor) a la más antigua. */
  list(programId: string): Promise<CatalogVersion[]>;
  findById(id: string): Promise<CatalogVersion | null>;
  /** La versión vigente (Aprobada) del programa, si existe. */
  findCurrent(programId: string): Promise<CatalogVersion | null>;
  /** La versión en Borrador o En validación del programa, si existe. */
  findOpen(programId: string): Promise<CatalogVersion | null>;
  /** Número más alto usado por el programa; 0 si no tiene versiones. */
  maxNumber(programId: string): Promise<number>;
}
