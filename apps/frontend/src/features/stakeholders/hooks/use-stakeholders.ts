import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListStakeholdersResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getStakeholders, type GetStakeholdersParams } from '../api/get-stakeholders';
import { stakeholderKeys } from './stakeholder-keys';

export function useStakeholders(
  params: GetStakeholdersParams = {},
): UseQueryResult<ListStakeholdersResponse, ApiError> {
  return useQuery<ListStakeholdersResponse, ApiError>({
    queryKey: stakeholderKeys.list(params),
    queryFn: () => getStakeholders(params),
    staleTime: 30_000,
    retry: false,
  });
}
