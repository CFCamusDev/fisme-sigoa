import { queryOptions } from '@tanstack/react-query';
import { myPermissionsResponseSchema, type MyPermissionsResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';
import { authorizationKeys } from '../hooks/authorization-keys';

export async function getMyPermissions(): Promise<MyPermissionsResponse> {
  const response = await apiClient.get<unknown>('/me/permissions');
  return myPermissionsResponseSchema.parse(response.data);
}

export function permissionsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: authorizationKeys.mePermissions.byUser(userId),
    queryFn: () => getMyPermissions(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
