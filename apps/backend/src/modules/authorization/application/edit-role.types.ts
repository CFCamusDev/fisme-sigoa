import type { RoleDto, UpdateRoleRequest } from '@sigoa/shared';

export interface EditRoleCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly roleId: string;
  readonly input: UpdateRoleRequest;
}

export type EditRoleResult = RoleDto;
