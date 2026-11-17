import type { StakeholderListMember } from '../entities/stakeholder-list-member.js';

export interface StakeholderListMemberRepository {
  add(member: StakeholderListMember): Promise<void>;
  addMany(members: readonly StakeholderListMember[]): Promise<void>;
  listByListId(listId: string): Promise<StakeholderListMember[]>;
}
