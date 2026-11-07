import type { ChangeRoleStatusRequest, RoleDto } from '@sigoa/shared';

export interface ChangeRoleStatusCommand {
  readonly actorId: string;
  readonly ip: string;
  readonly roleId: string;
  readonly input: ChangeRoleStatusRequest;
}

export type ChangeRoleStatusResult = RoleDto;
