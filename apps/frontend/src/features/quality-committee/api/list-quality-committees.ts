import {
  qualityCommitteeListResponseSchema,
  type QualityCommitteeListResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface ListQualityCommitteesParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export async function listQualityCommittees(
  params: ListQualityCommitteesParams = {},
): Promise<QualityCommitteeListResponse> {
  const response = await apiClient.get<unknown>('/quality-committees', {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
    },
  });
  return qualityCommitteeListResponseSchema.parse(response.data);
}
