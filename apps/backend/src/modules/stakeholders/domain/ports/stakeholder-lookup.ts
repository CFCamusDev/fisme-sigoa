import type { Stakeholder } from '../entities/stakeholder.js';

export interface StakeholderLookup {
  findByIds(ids: readonly string[]): Promise<Stakeholder[]>;
}
