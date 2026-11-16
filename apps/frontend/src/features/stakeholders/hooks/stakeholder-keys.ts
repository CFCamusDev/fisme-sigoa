import type { GetStakeholdersParams } from '../api/get-stakeholders';

export const stakeholderKeys = {
  all: ['stakeholders'] as const,
  lists: () => [...stakeholderKeys.all, 'list'] as const,
  list: (params: GetStakeholdersParams = {}) => [...stakeholderKeys.lists(), params] as const,
};
