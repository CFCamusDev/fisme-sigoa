import type { AddStakeholderListMemberRequest } from '@sigoa/shared';

export type AddStakeholderListMemberCommand = AddStakeholderListMemberRequest & {
  readonly listId: string;
  readonly actorId: string;
  readonly ip?: string | null;
};
