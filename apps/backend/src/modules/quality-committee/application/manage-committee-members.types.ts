import type { CommitteeMemberInput } from '@sigoa/shared';

export interface ManageCommitteeMembersCommand {
  readonly actorId: string;
  readonly ip?: string | null;
  readonly committeeId: string;
  readonly members: readonly CommitteeMemberInput[];
}
