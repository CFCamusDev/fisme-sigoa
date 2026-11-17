import type { GetStakeholderListsParams } from '../api/get-stakeholder-lists';

export const stakeholderListKeys = {
  all: ['stakeholder-lists'] as const,
  lists: () => [...stakeholderListKeys.all, 'list'] as const,
  list: (params: GetStakeholderListsParams = {}) =>
    [...stakeholderListKeys.lists(), params] as const,
};
