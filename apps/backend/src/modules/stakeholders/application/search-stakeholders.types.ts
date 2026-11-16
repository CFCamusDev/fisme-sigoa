import type { ListStakeholdersQuery } from '@sigoa/shared';

export type SearchStakeholdersQuery = ListStakeholdersQuery & {
  readonly actorId: string;
};
