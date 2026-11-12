import type { UserDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { UserNotFoundError } from '../domain/errors/index.js';
import { assertUserIdentityAvailable } from '../domain/policies/user-uniqueness.js';
import type { PermissionChecker, UserRepository, UserRoleGateway } from '../domain/ports/index.js';
import type { EditUserCommand } from './edit-user.types.js';
import { toUserDto } from './user-dto.js';

export interface EditUserUseCaseDependencies {
  readonly userRepository: UserRepository;
  readonly userRoleGateway: UserRoleGateway;
  readonly permissionChecker: PermissionChecker;
  readonly auditLogger: AuditLogger;
  readonly unitOfWork: UnitOfWork;
}

export class EditUserUseCase {
  public constructor(private readonly deps: EditUserUseCaseDependencies) {}

  public async execute(command: EditUserCommand): Promise<UserDto> {
    // 1. Autorización estricta antes de leer datos (AGENTS §4.2, RS-002)
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'usuario.editar',
      scope: 'GLOBAL',
    });

    // 2. Transacción de base de datos con bloqueo de fila (D8)
    return this.deps.unitOfWork.run(async () => {
      const user = await this.deps.userRepository.findByIdForUpdate(command.userId);
      if (!user) {
        throw new UserNotFoundError(command.userId);
      }

      // 3. Verificar colisiones de correo y DNI si sufren cambios
      const emailChanged = command.input.email !== undefined && command.input.email !== user.email;
      const dniChanged = command.input.dni !== undefined && command.input.dni !== user.dni;

      if (emailChanged || dniChanged) {
        const byEmail = emailChanged
          ? await this.deps.userRepository.findByEmail(command.input.email!)
          : null;
        const byDni = dniChanged
          ? await this.deps.userRepository.findByDni(command.input.dni!)
          : null;

        assertUserIdentityAvailable({
          email: command.input.email ?? user.email,
          dni: command.input.dni ?? user.dni ?? '',
          byEmail,
          byDni,
          exceptUserId: user.id,
        });
      }

      // 4. Aplicar cambios a la entidad
      const { before, after } = user.applyChanges(command.input, command.actorId);

      // 5. Cargar roles para el DTO
      const roleMap = await this.deps.userRoleGateway.getRoleIds([user.id]);
      const roleIds = roleMap.get(user.id) ?? [];

      // 6. Optimización D7: si no hay modificaciones reales en los datos,
      // no persistir ni generar registros superfluos de auditoría
      const hasChanges =
        before.names !== after.names ||
        before.firstSurname !== after.firstSurname ||
        before.secondSurname !== after.secondSurname ||
        before.email !== after.email ||
        before.dni !== after.dni;

      if (!hasChanges) {
        return toUserDto(user, roleIds);
      }

      // 7. Persistir y auditar atómicamente
      await this.deps.userRepository.save(user);

      await this.deps.auditLogger.log({
        action: 'UPDATE',
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
