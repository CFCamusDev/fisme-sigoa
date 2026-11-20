import type { CommitteeMemberPosition } from './committee-member-position.js';

export interface CommitteeMember {
  readonly id: string;
  readonly committeeId: string;
  readonly fullName: string;
  readonly degree: string;
  readonly position: CommitteeMemberPosition;
  readonly userId: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}
