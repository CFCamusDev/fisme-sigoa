import { listRolesResponseSchema, type ListRolesResponse } from '@sigoa/shared';
import type { RoleReader } from '../domain/ports/role-reader.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';

export interface ListRolesCommand {
  readonly actorId: string;
}

export interface ListRolesDependencies {
  readonly roleReader: RoleReader;
  readonly authorizer: PermissionAuthorizer;
}

export class ListRolesUseCase {
  constructor(private readonly deps: ListRolesDependencies) {}

  async execute(command: ListRolesCommand): Promise<ListRolesResponse> {
    await this.deps.authorizer.assertAllowed({
      actorId: command.actorId,
      permission: 'rol.ver',
      scope: 'GLOBAL',
    });

    const items = await this.deps.roleReader.listAll();
    return listRolesResponseSchema.parse({ items });
  }
}
