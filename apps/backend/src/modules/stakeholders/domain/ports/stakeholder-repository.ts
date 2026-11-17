import type { StakeholderStatus } from '../entities/stakeholder-enums.js';
import type { Stakeholder } from '../entities/stakeholder.js';

export interface StakeholderRepository {
  save(stakeholder: Stakeholder): Promise<void>;
  saveMany(stakeholders: readonly Stakeholder[]): Promise<void>;
  findById(id: string): Promise<Stakeholder | null>;
  saveChanges(stakeholder: Stakeholder, expectedStatus: StakeholderStatus): Promise<boolean>;
}
