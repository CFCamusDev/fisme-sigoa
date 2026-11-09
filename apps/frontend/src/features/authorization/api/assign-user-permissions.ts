import {
  assignUserPermissionsRequestSchema,
  userAccessSchema,
  type AssignUserPermissionsRequest,
  type UserAccessDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface AssignUserPermissionsParams {
  userId: string;
  body: AssignUserPermissionsRequest;
}

export async function assignUserPermissions({
  userId,
  body,
}: AssignUserPermissionsParams): Promise<UserAccessDto> {
  const validatedBody = assignUserPermissionsRequestSchema.parse(body);
  const response = await apiClient.put<unknown>(
    `/users/${encodeURIComponent(userId)}/permissions`,
    validatedBody,
  );
  return userAccessSchema.parse(response.data);
}
