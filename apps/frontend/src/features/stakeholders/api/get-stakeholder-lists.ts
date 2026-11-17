import {
  listStakeholderListsResponseSchema,
  type ListStakeholderListsQuery,
  type ListStakeholderListsResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type GetStakeholderListsParams = Partial<
  Omit<ListStakeholderListsQuery, 'includeMembers'>
> & {
  readonly includeMembers?: boolean;
};

/** Consulta listas del Anexo 3 filtradas por tipo y año. */
export async function getStakeholderLists(
  params: GetStakeholderListsParams = {},
): Promise<ListStakeholderListsResponse> {
  const queryParams = {
    ...params,
    ...(params.includeMembers !== undefined
      ? { includeMembers: params.includeMembers ? 'true' : 'false' }
      : {}),
  };
  const response = await apiClient.get<unknown>('/stakeholder-lists', { params: queryParams });
  return listStakeholderListsResponseSchema.parse(response.data);
}
