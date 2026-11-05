import {
  updateUserRequestSchema,
  userDtoSchema,
  type UpdateUserRequest,
  type UserDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function updateUser(id: string, body: UpdateUserRequest): Promise<UserDto> {
  const validatedBody = updateUserRequestSchema.parse(body);
  const response = await apiClient.patch<unknown>(
    `/users/${encodeURIComponent(id)}`,
    validatedBody,
  );
  return userDtoSchema.parse(response.data);
}
