import { userDtoSchema, type UserDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function getUser(id: string): Promise<UserDto> {
  const response = await apiClient.get<unknown>(`/users/${encodeURIComponent(id)}`);
  return userDtoSchema.parse(response.data);
}
