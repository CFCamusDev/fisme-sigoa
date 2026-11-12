import type { UserDto } from '@sigoa/shared';
import { UserNotFoundError } from '../domain/errors/index.js';
import type { PermissionChecker, UserRepository, UserRoleGateway } from '../domain/ports/index.js';
import type { GetUserCommand } from './get-user.types.js';
import { toUserDto } from './user-dto.js';

export interface GetUserUseCaseDependencies {
  readonly userRepository: UserRepository;
  readonly userRoleGateway: UserRoleGateway;
  readonly permissionChecker: PermissionChecker;
}

export class GetUserUseCase {
  public constructor(private readonly deps: GetUserUseCaseDependencies) {}

  public async execute(command: GetUserCommand): Promise<UserDto> {
    // 1. Autorización previa (AGENTS §4.2, RS-002)
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'usuario.ver',
      scope: 'GLOBAL',
    });

    // 2. Búsqueda del usuario por identificador
    const user = await this.deps.userRepository.findById(command.userId);
    if (!user) {
      throw new UserNotFoundError(command.userId);
    }

    // 3. Obtener roles asignados
    const roleMap = await this.deps.userRoleGateway.getRoleIds([user.id]);
    const roleIds = roleMap.get(user.id) ?? [];

    // 4. Mapeo a UserDto
    return toUserDto(user, roleIds);
  }
}
