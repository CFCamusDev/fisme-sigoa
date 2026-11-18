import { listSessionsResponseSchema, type ListSessionsResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface GetExecutionSessionsParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export async function getExecutionSessions(
  executionId: string,
  params: GetExecutionSessionsParams = {},
): Promise<ListSessionsResponse> {
  const response = await apiClient.get<unknown>(`/process-executions/${executionId}/sessions`, {
    params: {
      page: params.page,
      pageSize: params.pageSize,
    },
  });
  return listSessionsResponseSchema.parse(response.data);
}
