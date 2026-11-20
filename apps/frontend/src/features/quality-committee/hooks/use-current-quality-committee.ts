import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CurrentQualityCommitteeResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getCurrentQualityCommittee } from '../api/get-current-quality-committee';
import { qualityCommitteeKeys } from './quality-committee-keys';

export function useCurrentQualityCommittee(): UseQueryResult<
  CurrentQualityCommitteeResponse,
  ApiError
> {
  return useQuery<CurrentQualityCommitteeResponse, ApiError>({
    queryKey: qualityCommitteeKeys.current(),
    queryFn: getCurrentQualityCommittee,
    retry: false,
  });
}
