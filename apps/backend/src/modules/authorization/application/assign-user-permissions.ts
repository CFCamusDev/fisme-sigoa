import type { AssignUserPermissionsRequest, UserAccessDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { InvalidUserAccessDataError } from '../domain/errors/invalid-user-access-data-error.js';
import { UserAccessSubjectNotFoundError } from '../domain/errors/user-access-subject-not-found-error.js';
import type { PermissionRepository } from '../domain/ports/permission-repository.js';
import type { UserPermissionRepository } from '../domain/ports/user-permission-repository.js';
import type { UserAccessSubjectRepository } from '../domain/ports/user-access-subject-repository.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import type { UserAccessAssembler } from './user-access-assembler.js';

export interface AssignUserPermissionsDependencies {
  readonly subject: UserAccessSubjectRepository;
  readonly direct: UserPermissionRepository;
  readonly permissionRepository: PermissionRepository;
  readonly authorizer: PermissionAuthorizer;
  readonly assembler: UserAccessAssembler;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
}

export class AssignUserPermissionsUseCase {
  constructor(private readonly deps: AssignUserPermissionsDependencies) {}

  async execute(command: {
    actorId: string;
    userId: string;
    ip?: string;
    input: AssignUserPermissionsRequest;
  }): Promise<UserAccessDto> {
    await this.deps.authorizer.assertAllowed({
      actorId: command.actorId,
      permission: 'permiso.asignar',
      scope: 'GLOBAL',
    });
    const requested = command.input.permissions;
    const codes = requested.map((grant) => grant.permissionCode);
    if (new Set(codes).size !== codes.length) {
      throw new InvalidUserAccessDataError('No se permiten permisos duplicados', [
        { path: 'permissions', message: 'No se permiten permisos duplicados' },
      ]);
    }
    const catalog = codes.length ? await this.deps.permissionRepository.findByCodes(codes) : [];
    const catalogByCode = new Map(catalog.map((permission) => [permission.code, permission.id]));
    const invalid = requested.flatMap((grant, index) =>
      catalogByCode.has(grant.permissionCode)
        ? []
        : [
            {
              path: `permissions[${index}].permissionCode`,
              message: `El código de permiso '${grant.permissionCode}' no existe en el catálogo`,
            },
          ],
    );
    if (invalid.length)
      throw new InvalidUserAccessDataError('Los permisos solicitados no son válidos', invalid);
    const desired = requested.map((grant) => {
      const permissionId = catalogByCode.get(grant.permissionCode);
      if (!permissionId)
        throw new InvalidUserAccessDataError('Los permisos solicitados no son válidos');
      return { permissionId, scope: grant.scope };
    });

    return await this.deps.unitOfWork.run(async () => {
      const subject = await this.deps.subject.lockForUpdate(command.userId);
      if (!subject) throw new UserAccessSubjectNotFoundError();
      const current = await this.deps.direct.findByUserId(command.userId);
      const changes = await this.deps.direct.replaceForUser(
        command.userId,
        desired,
        command.actorId,
      );
      if (changes.added + changes.updated + changes.removed > 0) {
        const byCode = (a: { permissionCode: string }, b: { permissionCode: string }) =>
          a.permissionCode < b.permissionCode ? -1 : a.permissionCode > b.permissionCode ? 1 : 0;
        await this.deps.auditLogger.log({
          action: 'PERMISSION_CHANGE',
          entity: 'User',
          entityId: command.userId,
          actor: command.actorId,
          ip: command.ip,
          before: {
            permissions: current
              .map((grant) => ({ permissionCode: grant.permissionCode, scope: grant.scope }))
              .sort(byCode),
          },
          after: {
            permissions: requested
              .map((grant) => ({ permissionCode: grant.permissionCode, scope: grant.scope }))
              .sort(byCode),
          },
        });
      }
      return this.deps.assembler.build(command.userId);
    });
  }
}
