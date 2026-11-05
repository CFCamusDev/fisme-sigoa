import {
  changeUserStatusRequestSchema,
  userDtoSchema,
  type ChangeUserStatusRequest,
  type UserDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function changeUserStatus(
  id: string,
  body: ChangeUserStatusRequest,
): Promise<UserDto> {
  const validatedBody = changeUserStatusRequestSchema.parse(body);
  const response = await apiClient.patch<unknown>(
    `/users/${encodeURIComponent(id)}/status`,
    validatedBody,
  );
  return userDtoSchema.parse(response.data);
}
