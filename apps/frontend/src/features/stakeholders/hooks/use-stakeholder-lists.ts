import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  STAKEHOLDER_LIST_YEAR_MAX,
  STAKEHOLDER_LIST_YEAR_MIN,
  type ListStakeholderListsResponse,
  type StakeholderListTypeValue,
} from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getStakeholderLists, type GetStakeholderListsParams } from '../api/get-stakeholder-lists';
import { stakeholderListKeys } from './stakeholder-list-keys';

export interface UseStakeholderListsOptions {
  readonly type: StakeholderListTypeValue;
  readonly year: number;
  readonly includeMembers?: boolean;
}

export function useStakeholderLists(
  options: UseStakeholderListsOptions,
): UseQueryResult<ListStakeholderListsResponse, ApiError> {
  const isValidYear =
    Number.isInteger(options.year) &&
    options.year >= STAKEHOLDER_LIST_YEAR_MIN &&
    options.year <= STAKEHOLDER_LIST_YEAR_MAX;

  const params: GetStakeholderListsParams = {
    type: options.type,
    year: options.year,
    includeMembers: options.includeMembers ?? true,
    page: 1,
    pageSize: 20,
  };

  return useQuery<ListStakeholderListsResponse, ApiError>({
    queryKey: stakeholderListKeys.list(params),
    queryFn: () => getStakeholderLists(params),
    enabled: Boolean(options.type) && isValidYear,
    staleTime: 30_000,
    retry: false,
  });
}
