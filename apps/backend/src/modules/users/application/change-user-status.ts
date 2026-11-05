import type { UserDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { CannotDeactivateSelfError, UserNotFoundError } from '../domain/errors/index.js';
import type {
  PermissionChecker,
  UserRepository,
  UserRoleGateway,
  UserSessionRevoker,
} from '../domain/ports/index.js';
import type { ChangeUserStatusCommand } from './change-user-status.types.js';
import { toUserDto } from './user-dto.js';

export interface ChangeUserStatusDependencies {
  readonly userRepository: UserRepository;
  readonly userRoleGateway: UserRoleGateway;
  readonly userSessionRevoker: UserSessionRevoker;
  readonly permissionChecker: PermissionChecker;
  readonly auditLogger: AuditLogger;
  readonly unitOfWork: UnitOfWork;
  readonly clock?: () => Date;
}

export class ChangeUserStatusUseCase {
  public constructor(private readonly deps: ChangeUserStatusDependencies) {}

  public async execute(command: ChangeUserStatusCommand): Promise<UserDto> {
    // 1. Autorización previa antes de cualquier lectura (AGENTS §4.2, RS-002)
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'usuario.editar',
      scope: 'GLOBAL',
    });

    // 2. Prevenir que un administrador inactive su propia cuenta (D9)
    if (command.input.status === 'INACTIVE' && command.userId === command.actorId) {
      throw new CannotDeactivateSelfError();
    }

    // 3. Transacción atómica de cambio de estado y revocación de sesiones (RS-020, RNF-022, D5)
    return this.deps.unitOfWork.run(async () => {
      const user = await this.deps.userRepository.findByIdForUpdate(command.userId);
      if (!user) {
        throw new UserNotFoundError(command.userId);
      }

      const now = this.deps.clock ? this.deps.clock() : new Date();

      if (command.input.status === 'INACTIVE') {
        const { before, after } = user.deactivate(command.actorId);
        await this.deps.userRepository.save(user);

        const revokedSessions = await this.deps.userSessionRevoker.revokeAllForUser(user.id, now);

        const roleMap = await this.deps.userRoleGateway.getRoleIds([user.id]);
        const roleIds = roleMap.get(user.id) ?? [];

        await this.deps.auditLogger.log({
          action: 'STATE_CHANGE',
          entity: 'User',
          entityId: user.id,
          actor: command.actorId,
          ip: command.ip,
          before: {
            ...before,
            roleIds,
          },
          after: {
            ...after,
            roleIds,
            revokedSessions,
          },
        });

        return toUserDto(user, roleIds);
      }

      // command.input.status === 'ACTIVE'
      const { before, after } = user.reactivate(command.actorId);
      await this.deps.userRepository.save(user);

      const roleMap = await this.deps.userRoleGateway.getRoleIds([user.id]);
      const roleIds = roleMap.get(user.id) ?? [];

      await this.deps.auditLogger.log({
        action: 'STATE_CHANGE',
        entity: 'User',
        entityId: user.id,
        actor: command.actorId,
        ip: command.ip,
        before: {
          ...before,
          roleIds,
        },
        after: {
          ...after,
          roleIds,
        },
      });

      return toUserDto(user, roleIds);
    });
  }
}
