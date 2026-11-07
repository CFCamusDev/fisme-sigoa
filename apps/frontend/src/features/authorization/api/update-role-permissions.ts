import {
  updateRolePermissionsRequestSchema,
  roleDtoSchema,
  type UpdateRolePermissionsRequest,
  type RoleDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface UpdateRolePermissionsParams {
  id: string;
  body: UpdateRolePermissionsRequest;
}

export async function updateRolePermissions({
  id,
  body,
}: UpdateRolePermissionsParams): Promise<RoleDto> {
  const validatedBody = updateRolePermissionsRequestSchema.parse(body);
  const response = await apiClient.put<unknown>(
    `/roles/${encodeURIComponent(id)}/permissions`,
    validatedBody,
  );
  return roleDtoSchema.parse(response.data);
}
