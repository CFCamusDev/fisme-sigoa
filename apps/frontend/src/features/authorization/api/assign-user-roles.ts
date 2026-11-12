import {
  assignUserRolesRequestSchema,
  userAccessSchema,
  type AssignUserRolesRequest,
  type UserAccessDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface AssignUserRolesParams {
  userId: string;
  body: AssignUserRolesRequest;
}

export async function assignUserRoles({
  userId,
  body,
}: AssignUserRolesParams): Promise<UserAccessDto> {
  const validatedBody = assignUserRolesRequestSchema.parse(body);
  const response = await apiClient.put<unknown>(
    `/users/${encodeURIComponent(userId)}/roles`,
    validatedBody,
  );
  return userAccessSchema.parse(response.data);
}
