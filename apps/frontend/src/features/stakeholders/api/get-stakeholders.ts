import {
  listStakeholdersResponseSchema,
  type ListStakeholdersQuery,
  type ListStakeholdersResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type GetStakeholdersParams = Partial<ListStakeholdersQuery>;

/** Constituyentes ordenados por nombre, con filtros y paginación opcionales. */
export async function getStakeholders(
  params: GetStakeholdersParams = {},
): Promise<ListStakeholdersResponse> {
  const response = await apiClient.get<unknown>('/stakeholders', { params });
  return listStakeholdersResponseSchema.parse(response.data);
}
