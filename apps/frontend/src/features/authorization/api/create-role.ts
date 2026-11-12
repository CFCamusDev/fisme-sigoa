import {
  createRoleRequestSchema,
  roleDtoSchema,
  type CreateRoleRequest,
  type RoleDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function createRole(body: CreateRoleRequest): Promise<RoleDto> {
  const validatedBody = createRoleRequestSchema.parse(body);
  const response = await apiClient.post<unknown>('/roles', validatedBody);
  return roleDtoSchema.parse(response.data);
}
