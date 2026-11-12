import type { ListUsersQuery, ListUsersResponse } from '@sigoa/shared';

export interface ListUsersCommand {
  readonly actorId: string;
  readonly query: Partial<ListUsersQuery>;
}

export type { ListUsersResponse };
