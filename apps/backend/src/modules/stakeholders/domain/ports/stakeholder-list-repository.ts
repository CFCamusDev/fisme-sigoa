import type { StakeholderList } from '../entities/stakeholder-list.js';

export interface StakeholderListRepository {
  save(list: StakeholderList): Promise<void>;
  findById(id: string): Promise<StakeholderList | null>;
}
