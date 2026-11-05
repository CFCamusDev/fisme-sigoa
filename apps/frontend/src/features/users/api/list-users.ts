import {
  listUsersQuerySchema,
  listUsersResponseSchema,
  type ListUsersQuery,
  type ListUsersResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function listUsers(query?: ListUsersQuery): Promise<ListUsersResponse> {
  const validatedQuery = query ? listUsersQuerySchema.parse(query) : undefined;
  const response = await apiClient.get<unknown>('/users', {
    params: validatedQuery,
  });
  return listUsersResponseSchema.parse(response.data);
}
