import { listPermissionsResponseSchema, type ListPermissionsResponse } from '@sigoa/shared';
import type { PermissionRepository } from '../domain/ports/permission-repository.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';

export interface ListPermissionsCommand {
  readonly actorId: string;
}

export interface ListPermissionsDependencies {
  readonly permissionRepository: PermissionRepository;
  readonly authorizer: PermissionAuthorizer;
}

export class ListPermissionsUseCase {
  constructor(private readonly deps: ListPermissionsDependencies) {}

  async execute(command: ListPermissionsCommand): Promise<ListPermissionsResponse> {
    await this.deps.authorizer.assertAllowed({
      actorId: command.actorId,
      permission: 'rol.ver',
      scope: 'GLOBAL',
    });

    const permissions = await this.deps.permissionRepository.findAll();

    const items = permissions.map((p) => ({
      code: p.code,
      description: p.description,
      module: p.module,
    }));

    return listPermissionsResponseSchema.parse({ items });
  }
}
