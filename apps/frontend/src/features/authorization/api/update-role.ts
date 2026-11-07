import {
  updateRoleRequestSchema,
  roleDtoSchema,
  type UpdateRoleRequest,
  type RoleDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface UpdateRoleParams {
  id: string;
  body: UpdateRoleRequest;
}

export async function updateRole({ id, body }: UpdateRoleParams): Promise<RoleDto> {
  const validatedBody = updateRoleRequestSchema.parse(body);
  const response = await apiClient.patch<unknown>(
    `/roles/${encodeURIComponent(id)}`,
    validatedBody,
  );
  return roleDtoSchema.parse(response.data);
}
