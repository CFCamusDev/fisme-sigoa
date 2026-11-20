import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { QualityCommitteeListResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import {
  listQualityCommittees,
  type ListQualityCommitteesParams,
} from '../api/list-quality-committees';
import { qualityCommitteeKeys } from './quality-committee-keys';

export function useQualityCommittees(
  params: ListQualityCommitteesParams = {},
): UseQueryResult<QualityCommitteeListResponse, ApiError> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;

  return useQuery<QualityCommitteeListResponse, ApiError>({
    queryKey: qualityCommitteeKeys.list({ page, pageSize }),
    queryFn: () => listQualityCommittees({ page, pageSize }),
    retry: false,
  });
}
