import type { StakeholderList } from '../entities/stakeholder-list.js';
import type { StakeholderListType } from '../entities/stakeholder-list-enums.js';
import type { StakeholderListMember } from '../entities/stakeholder-list-member.js';

export interface ListStakeholderListsFilter {
  readonly type?: StakeholderListType;
  readonly year?: number;
  readonly includeMembers: boolean;
  readonly page: number;
  readonly pageSize: number;
}

export interface StakeholderListSummaryItem {
  readonly list: StakeholderList;
  readonly memberCount: number;
  readonly members: readonly StakeholderListMember[] | null;
}

export interface StakeholderListPage {
  readonly items: readonly StakeholderListSummaryItem[];
  readonly total: number;
}

export interface StakeholderListReader {
  list(filter: ListStakeholderListsFilter): Promise<StakeholderListPage>;
}
