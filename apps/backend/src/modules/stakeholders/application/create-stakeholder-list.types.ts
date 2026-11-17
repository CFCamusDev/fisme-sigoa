import type { CreateStakeholderListRequest } from '@sigoa/shared';

export type CreateStakeholderListCommand = CreateStakeholderListRequest & {
  readonly actorId: string;
  readonly ip?: string | null;
};
