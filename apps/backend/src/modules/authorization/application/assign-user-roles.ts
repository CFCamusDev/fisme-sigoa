import {
  PROTECTED_ROLE_CODE,
  type AssignUserRolesRequest,
  type UserAccessDto,
} from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { InvalidUserAccessDataError } from '../domain/errors/invalid-user-access-data-error.js';
import { ProtectedRoleError } from '../domain/errors/protected-role-error.js';
import { RoleNotFoundError } from '../domain/errors/role-not-found-error.js';
import { UserAccessSubjectNotFoundError } from '../domain/errors/user-access-subject-not-found-error.js';
import type { Role } from '../domain/entities/role.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { UserRoleRepository } from '../domain/ports/user-role-repository.js';
import type { UserAccessSubjectRepository } from '../domain/ports/user-access-subject-repository.js';
import type { PermissionCacheInvalidator } from '../domain/ports/permission-cache-invalidator.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import type { UserAccessAssembler } from './user-access-assembler.js';

export interface AssignUserRolesDependencies {
  readonly subject: UserAccessSubjectRepository;
  readonly roles: UserRoleRepository;
  readonly roleRepository: RoleRepository;
  readonly authorizer: PermissionAuthorizer;
  readonly assembler: UserAccessAssembler;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly permissionCache: PermissionCacheInvalidator;
}

export class AssignUserRolesUseCase {
  constructor(private readonly deps: AssignUserRolesDependencies) {}

  async execute(command: {
    actorId: string;
    userId: string;
    ip?: string;
    input: AssignUserRolesRequest;
  }): Promise<UserAccessDto> {
    await this.deps.authorizer.assertAllowed({
      actorId: command.actorId,
      permission: 'usuario.editar',
      scope: 'GLOBAL',
    });
    const roleIds = command.input.roleIds;
    if (new Set(roleIds).size !== roleIds.length) {
      throw new InvalidUserAccessDataError('No se permiten roles duplicados', [
        { path: 'roleIds', message: 'No se permiten roles duplicados' },
      ]);
    }
    let hasChanged = false;

    const result = await this.deps.unitOfWork.run(async () => {
      const administrator = await this.deps.roleRepository.findByCode(PROTECTED_ROLE_CODE);
      if (!administrator) throw new RoleNotFoundError('Rol Administrador no encontrado.');
      const lockedAdministrator = await this.deps.roleRepository.findByIdForUpdate(
        administrator.id,
      );
      if (!lockedAdministrator) throw new RoleNotFoundError('Rol Administrador no encontrado.');
      const subject = await this.deps.subject.lockForUpdate(command.userId);
      if (!subject) throw new UserAccessSubjectNotFoundError();
      const current = await this.deps.roles.findByUserId(command.userId);
      const currentIds = new Set(current.map((role) => role.roleId));
      const requested: Role[] = [];
      for (const [index, id] of roleIds.entries()) {
        const role = await this.deps.roleRepository.findById(id);
        if (!role)
          throw new InvalidUserAccessDataError('Los roles solicitados no son válidos', [
            { path: `roleIds[${index}]`, message: 'El rol no existe' },
          ]);
        if (role.status === 'INACTIVE' && !currentIds.has(id))
          throw new InvalidUserAccessDataError('No se puede asignar un rol inactivo', [
            { path: `roleIds[${index}]`, message: 'El rol está inactivo' },
          ]);
        requested.push(role);
      }
      if (
        subject.status === 'ACTIVE' &&
        currentIds.has(lockedAdministrator.id) &&
        !roleIds.includes(lockedAdministrator.id) &&
        (await this.deps.roles.countActiveHolders(lockedAdministrator.id, command.userId)) === 0
      ) {
        throw new ProtectedRoleError(
          'Debe existir al menos un usuario activo con el rol Administrador.',
        );
      }
      const changes = await this.deps.roles.replaceForUser(
        command.userId,
        roleIds,
        command.actorId,
      );
      if (changes.added.length || changes.removed.length) {
        hasChanged = true;
        const byCode = (a: { code: string }, b: { code: string }) =>
          a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
        await this.deps.auditLogger.log({
          action: 'ROLE_CHANGE',
          entity: 'User',
          entityId: command.userId,
          actor: command.actorId,
          ip: command.ip,
          before: {
            roles: current.map((role) => ({ id: role.roleId, code: role.roleCode })).sort(byCode),
          },
          after: {
            roles: requested.map((role) => ({ id: role.id, code: role.code })).sort(byCode),
          },
        });
      }
      return this.deps.assembler.build(command.userId);
    });

    if (hasChanged) {
      this.deps.permissionCache.invalidateUser(command.userId);
    }

    return result;
  }
}
