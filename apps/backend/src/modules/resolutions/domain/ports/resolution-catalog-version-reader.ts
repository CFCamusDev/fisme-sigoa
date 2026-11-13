export type ResolutionCatalogVersionStatus = 'DRAFT' | 'IN_VALIDATION' | 'APPROVED' | 'HISTORICAL';

export interface ResolutionCatalogVersionSummary {
  readonly id: string;
  readonly status: ResolutionCatalogVersionStatus;
}

/** Lee la versión del catálogo sin importar el interior del módulo `catalog`. */
export interface ResolutionCatalogVersionReader {
  findById(versionId: string): Promise<ResolutionCatalogVersionSummary | null>;
}
