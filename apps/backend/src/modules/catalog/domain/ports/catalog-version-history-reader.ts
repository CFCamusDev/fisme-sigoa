export type CatalogResolutionType =
  'EDUCATIONAL_OBJECTIVE' | 'GRADUATE_ATTRIBUTE' | 'IMPROVEMENT_PLAN';
export type CatalogResolutionStatus = 'REGISTERED' | 'APPROVED';

/** Resolución vinculada a una versión del catálogo, tal como la necesita el historial (RN-021). */
export interface CatalogVersionResolutionRecord {
  readonly id: string;
  readonly type: CatalogResolutionType;
  readonly number: string;
  /** Fecha de calendario de la resolución (sin hora). */
  readonly issuedOn: Date;
  readonly status: CatalogResolutionStatus;
  readonly approvedAt: Date | null;
  readonly hasPdf: boolean;
}

export interface CatalogVersionHistoryReader {
  /**
   * Resoluciones OE/AG vinculadas a cada versión del programa, por id de versión. Las versiones
   * sin resolución no aparecen en el mapa. Solo lectura; no expone quién registró o aprobó.
   */
  listForProgram(
    programId: string,
  ): Promise<ReadonlyMap<string, readonly CatalogVersionResolutionRecord[]>>;
}
