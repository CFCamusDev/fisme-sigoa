import {
  changeRoleStatusRequestSchema,
  roleDtoSchema,
  type ChangeRoleStatusRequest,
  type RoleDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface ChangeRoleStatusParams {
  id: string;
  body: ChangeRoleStatusRequest;
}

export async function changeRoleStatus({ id, body }: ChangeRoleStatusParams): Promise<RoleDto> {
  const validatedBody = changeRoleStatusRequestSchema.parse(body);
  const response = await apiClient.patch<unknown>(
    `/roles/${encodeURIComponent(id)}/status`,
    validatedBody,
  );
  return roleDtoSchema.parse(response.data);
}
