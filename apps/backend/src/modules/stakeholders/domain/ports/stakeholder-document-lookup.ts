import type { Stakeholder } from '../entities/stakeholder.js';

export interface StakeholderDocumentLookup {
  findByDocuments(documents: {
    readonly dnis: readonly string[];
    readonly rucs: readonly string[];
  }): Promise<Stakeholder[]>;
}
