import type { ListUsersQueryInput } from '../api/list-users';

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (query?: ListUsersQueryInput) => [...usersKeys.lists(), query ?? {}] as const,
  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
};

export const rolesKeys = {
  all: ['roles'] as const,
};
