import type { CommitteeMemberPosition } from '../entities/committee-member-position.js';
import type { CommitteeMember } from '../entities/committee-member.js';

export interface CommitteeMemberEntry {
  readonly fullName: string;
  readonly degree: string;
  readonly position: CommitteeMemberPosition;
  readonly userId: string | null;
}

export interface CreateCommitteeMembersInput {
  readonly committeeId: string;
  readonly entries: readonly CommitteeMemberEntry[];
  readonly actorId: string;
  readonly now: Date;
}

export interface ReplaceCommitteeMembersInput {
  readonly committeeId: string;
  readonly entries: readonly CommitteeMemberEntry[];
  readonly actorId: string;
  readonly now: Date;
}

export interface CommitteeMemberRepository {
  listByCommittee(committeeId: string): Promise<readonly CommitteeMember[]>;
  listByCommittees(committeeIds: readonly string[]): Promise<readonly CommitteeMember[]>;
  createMany(input: CreateCommitteeMembersInput): Promise<readonly CommitteeMember[]>;
  replaceForCommittee(input: ReplaceCommitteeMembersInput): Promise<readonly CommitteeMember[]>;
}
