import { roleDtoSchema } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { RoleAlreadyExistsError } from '../domain/errors/role-already-exists-error.js';
import { RoleNotFoundError } from '../domain/errors/role-not-found-error.js';
import type { RoleReader } from '../domain/ports/role-reader.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { EditRoleCommand, EditRoleResult } from './edit-role.types.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';

export interface EditRoleDependencies {
  readonly roleRepository: RoleRepository;
  readonly roleReader: RoleReader;
  readonly authorizer: PermissionAuthorizer;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
}

export class EditRoleUseCase {
  constructor(private readonly deps: EditRoleDependencies) {}

  async execute(command: EditRoleCommand): Promise<EditRoleResult> {
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

      const { before, after, hasChanges } = role.applyChanges(command.input, command.actorId);

      if (!hasChanges) {
        return;
      }

      if (before.name !== after.name) {
        const existingWithSameName = await this.deps.roleRepository.findByName(after.name);
        if (existingWithSameName && existingWithSameName.id !== role.id) {
          throw new RoleAlreadyExistsError();
        }
      }

      await this.deps.roleRepository.save(role);

      await this.deps.auditLogger.log({
        action: 'UPDATE',
        entity: 'Role',
        entityId: role.id,
        actor: command.actorId,
        ip: command.ip,
        before,
        after,
      });
    });

    const updatedRoleDto = await this.deps.roleReader.findById(command.roleId);
    if (!updatedRoleDto) {
      throw new RoleNotFoundError();
    }

    return roleDtoSchema.parse(updatedRoleDto);
  }
}
