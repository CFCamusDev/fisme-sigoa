export interface CatalogProgramReader {
  /** Identificador del programa al que pertenece el catálogo, o `null` si no hay ninguno. */
  getCurrentProgramId(): Promise<string | null>;
}
