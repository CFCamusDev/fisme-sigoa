import { listRolesResponseSchema, type ListRolesResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function listRoles(): Promise<ListRolesResponse> {
  const response = await apiClient.get<unknown>('/roles');
  return listRolesResponseSchema.parse(response.data);
}
