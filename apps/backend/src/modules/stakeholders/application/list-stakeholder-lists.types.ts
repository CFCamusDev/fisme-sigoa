import type { ListStakeholderListsQuery } from '@sigoa/shared';

export type ListStakeholderListsQueryInput = ListStakeholderListsQuery & {
  readonly actorId: string;
};
