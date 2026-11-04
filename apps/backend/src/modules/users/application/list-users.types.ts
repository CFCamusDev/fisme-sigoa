import type { ListUsersQuery, ListUsersResponse } from '@sigoa/shared';

export interface ListUsersCommand {
  readonly actorId: string;
  readonly query: ListUsersQuery;
}

export type { ListUsersResponse };
