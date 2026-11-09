import { userAccessSchema, type UserAccessDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function getUserAccess(userId: string): Promise<UserAccessDto> {
  const response = await apiClient.get<unknown>(
    `/users/${encodeURIComponent(userId)}/effective-permissions`,
  );
  return userAccessSchema.parse(response.data);
}
