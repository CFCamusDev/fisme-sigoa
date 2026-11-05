import {
  listUsersQuerySchema,
  listUsersResponseSchema,
  type ListUsersResponse,
} from '@sigoa/shared';
import type { z } from 'zod';
import { apiClient } from '@/lib/axios';

export type ListUsersQueryInput = z.input<typeof listUsersQuerySchema>;

export async function listUsers(query?: ListUsersQueryInput): Promise<ListUsersResponse> {
  const validatedQuery = query ? listUsersQuerySchema.parse(query) : undefined;
  const response = await apiClient.get<unknown>('/users', {
    params: validatedQuery,
  });
  return listUsersResponseSchema.parse(response.data);
}
