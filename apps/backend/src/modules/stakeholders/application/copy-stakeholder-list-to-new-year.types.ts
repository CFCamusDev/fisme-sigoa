import type { CopyStakeholderListRequest } from '@sigoa/shared';

export type CopyStakeholderListToNewYearCommand = CopyStakeholderListRequest & {
  readonly sourceListId: string;
  readonly actorId: string;
  readonly ip?: string | null;
};
