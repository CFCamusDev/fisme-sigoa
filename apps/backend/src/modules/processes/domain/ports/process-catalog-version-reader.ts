import type { ProcessCatalogVersionStatus } from '../policies/process-catalog-version-rule.js';

export interface ProcessCatalogVersionRecord {
  readonly id: string;
  readonly number: number;
  readonly programId: string;
  readonly status: ProcessCatalogVersionStatus;
}

export interface ProcessCatalogVersionReader {
  findById(id: string): Promise<ProcessCatalogVersionRecord | null>;
}
