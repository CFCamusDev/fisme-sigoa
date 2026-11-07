import { roleDtoSchema } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { InvalidRoleStatusTransitionError } from '../domain/errors/invalid-role-status-transition-error.js';
import { ProtectedRoleError } from '../domain/errors/protected-role-error.js';
import { RoleDeactivationRequiresConfirmationError } from '../domain/errors/role-deactivation-requires-confirmation-error.js';
import { RoleNotFoundError } from '../domain/errors/role-not-found-error.js';
import type { RoleReader } from '../domain/ports/role-reader.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type {
  ChangeRoleStatusCommand,
  ChangeRoleStatusResult,
} from './change-role-status.types.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';

export interface ChangeRoleStatusDependencies {
  readonly roleRepository: RoleRepository;
  readonly roleReader: RoleReader;
  readonly authorizer: PermissionAuthorizer;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
}

export class ChangeRoleStatusUseCase {
  constructor(private readonly deps: ChangeRoleStatusDependencies) {}

  async execute(command: ChangeRoleStatusCommand): Promise<ChangeRoleStatusResult> {
    await this.deps.authorizer.assertAllowed({
      actorId: command.actorId,
      permission: 'rol.editar',
      scope: 'GLOBAL',
    });

    await this.deps.unitOfWork.run(async () => {
      const role = await this.deps.roleRepository.findByIdForUpdate(command.roleId);
      if (!role) {
        throw new RoleNotFoundError();
      }

      if (command.input.status === 'INACTIVE') {
        if (role.status === 'INACTIVE') {
          throw new InvalidRoleStatusTransitionError('El rol ya se encuentra inactivo');
        }

        if (role.code === 'ADMINISTRATOR') {
          throw new ProtectedRoleError('El rol Administrador no puede ser desactivado.');
        }

        const currentRoleDto = await this.deps.roleReader.findById(role.id);
        const userCount = currentRoleDto?.userCount ?? 0;

        if (userCount > 0 && command.input.confirmed !== true) {
          throw new RoleDeactivationRequiresConfirmationError(userCount);
        }

        const { before, after } = role.deactivate(command.actorId);
        await this.deps.roleRepository.save(role);

        await this.deps.auditLogger.log({
          action: 'STATE_CHANGE',
          entity: 'Role',
          entityId: role.id,
          actor: command.actorId,
          ip: command.ip,
          before,
          after: {
            ...after,
            userCount,
          },
        });
      } else {
        if (role.status === 'ACTIVE') {
          throw new InvalidRoleStatusTransitionError('El rol ya se encuentra activo');
        }

        const { before, after } = role.reactivate(command.actorId);
        await this.deps.roleRepository.save(role);

        await this.deps.auditLogger.log({
          action: 'STATE_CHANGE',
          entity: 'Role',
          entityId: role.id,
          actor: command.actorId,
          ip: command.ip,
          before,
          after,
        });
      }
    });

    const updatedRoleDto = await this.deps.roleReader.findById(command.roleId);
    if (!updatedRoleDto) {
      throw new RoleNotFoundError();
    }

    return roleDtoSchema.parse(updatedRoleDto);
  }
}
