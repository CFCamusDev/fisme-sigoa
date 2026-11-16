import type { StakeholderKind, StakeholderStatus } from '../entities/stakeholder-enums.js';
import type { Stakeholder } from '../entities/stakeholder.js';

export interface ListStakeholdersFilter {
  readonly search?: string;
  readonly kind?: StakeholderKind;
  readonly status?: StakeholderStatus;
  readonly document?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface StakeholderPage {
  readonly items: readonly Stakeholder[];
  readonly total: number;
}

export interface StakeholderReader {
  list(filter: ListStakeholdersFilter): Promise<StakeholderPage>;
}
