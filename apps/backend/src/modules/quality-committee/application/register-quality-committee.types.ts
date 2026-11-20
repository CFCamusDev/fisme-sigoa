import type { CommitteeMemberInput } from '@sigoa/shared';

export interface RegisterQualityCommitteeCommand {
  readonly actorId: string;
  readonly ip?: string | null;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly members: readonly CommitteeMemberInput[];
}
