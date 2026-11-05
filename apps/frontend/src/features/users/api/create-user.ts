import {
  createUserRequestSchema,
  userDtoSchema,
  type CreateUserRequest,
  type UserDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function createUser(body: CreateUserRequest): Promise<UserDto> {
  const validatedBody = createUserRequestSchema.parse(body);
  const response = await apiClient.post<unknown>('/users', validatedBody);
  return userDtoSchema.parse(response.data);
}
