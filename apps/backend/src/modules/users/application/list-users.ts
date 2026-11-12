import { USERS_PAGE_SIZE_DEFAULT, type ListUsersResponse } from '@sigoa/shared';
import type { PermissionChecker, UserListReader, UserRoleGateway } from '../domain/ports/index.js';
import type { ListUsersCommand } from './list-users.types.js';
import { toUserDto } from './user-dto.js';

export interface ListUsersDependencies {
  readonly userListReader: UserListReader;
  readonly userRoleGateway: UserRoleGateway;
  readonly permissionChecker: PermissionChecker;
}

export class ListUsersUseCase {
  public constructor(private readonly deps: ListUsersDependencies) {}

  public async execute(command: ListUsersCommand): Promise<ListUsersResponse> {
    // 1. Autorización previa (AGENTS §4.2, RS-002)
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'usuario.ver',
      scope: 'GLOBAL',
    });

    // 2. Parámetros de paginación con valores por defecto
    const page = command.query.page ?? 1;
    const pageSize = command.query.pageSize ?? USERS_PAGE_SIZE_DEFAULT;

    // 3. Lectura de usuarios mediante el puerto de lectura (D10)
    const { items, total } = await this.deps.userListReader.list({
      status: command.query.status,
      roleId: command.query.roleId,
      page,
      pageSize,
    });

    // 4. Carga en bloque (batch) de roles para evitar el problema N+1
    const userIds = items.map((u) => u.id);
    const roleMap =
      userIds.length > 0
        ? await this.deps.userRoleGateway.getRoleIds(userIds)
        : new Map<string, string[]>();

    // 5. Cálculo determinista de totalPages
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    // 6. Mapeo a UserDto
    const userDtos = items.map((user) => {
      const roleIds = roleMap.get(user.id) ?? [];
      return toUserDto(user, roleIds);
    });

    return {
      items: userDtos,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
