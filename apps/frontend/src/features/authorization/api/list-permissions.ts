import { listPermissionsResponseSchema, type ListPermissionsResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function listPermissions(): Promise<ListPermissionsResponse> {
  const response = await apiClient.get<unknown>('/permissions');
  return listPermissionsResponseSchema.parse(response.data);
}
