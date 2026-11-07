import { roleDtoSchema, type RoleDto } from '@sigoa/shared';
import { AppError } from '../../../shared/errors/app-error.js';
import { InvalidRoleDataError } from '../domain/errors/invalid-role-data-error.js';
import { RoleNotFoundError } from '../domain/errors/role-not-found-error.js';
import { assertProtectedRoleKeepsRoleManagement } from '../domain/policies/protected-role-grants.js';
import type {
  EditRolePermissionsCommand,
  EditRolePermissionsDependencies,
} from './edit-role-permissions.types.js';

export class EditRolePermissionsUseCase {
  constructor(private readonly deps: EditRolePermissionsDependencies) {}

  async execute(command: EditRolePermissionsCommand): Promise<RoleDto> {
    await this.deps.authorizer.assertAllowed({
      actorId: command.actorId,
      permission: 'rol.editar',
      scope: 'GLOBAL',
    });

    const requestedGrants = command.input.permissions;
    const requestedCodes = requestedGrants.map((g) => g.permissionCode);

    // Verificación de duplicados
    const uniqueCodes = new Set(requestedCodes);
    if (uniqueCodes.size !== requestedCodes.length) {
      throw new InvalidRoleDataError('No se permiten códigos de permiso duplicados', [
        { path: 'permissions', message: 'No se permiten códigos de permiso duplicados' },
      ]);
    }

    let catalogMap = new Map<string, { id: string; code: string }>();

    if (requestedCodes.length > 0) {
      const catalogPermissions = await this.deps.permissionRepository.findByCodes(requestedCodes);
      catalogMap = new Map(catalogPermissions.map((p) => [p.code, p]));

      const unknownDetails = requestedGrants
        .map((grant, index) => ({ grant, index }))
        .filter(({ grant }) => !catalogMap.has(grant.permissionCode))
        .map(({ grant, index }) => ({
          path: `permissions[${index}].permissionCode`,
          message: `El código de permiso '${grant.permissionCode}' no existe en el catálogo`,
        }));

      if (unknownDetails.length > 0) {
        throw new InvalidRoleDataError('Los permisos solicitados no son válidos', unknownDetails);
      }
    }

    return await this.deps.unitOfWork.run(async () => {
      const role = await this.deps.roleRepository.findByIdForUpdate(command.roleId);
      if (!role) {
        throw new RoleNotFoundError(`No se encontró el rol con identificador '${command.roleId}'.`);
      }

      // Evaluar candado del Administrador
      assertProtectedRoleKeepsRoleManagement(role.code, requestedGrants);

      // Obtener concesiones previas para la auditoría
      const currentGrants = await this.deps.rolePermissionRepository.findByRoleId(role.id);

      const desiredGrants = requestedGrants.map((grant) => {
        const perm = catalogMap.get(grant.permissionCode)!;
        return {
          permissionId: perm.id,
          scope: grant.scope,
        };
      });

      const replaceResult = await this.deps.rolePermissionRepository.replaceForRole(
        role.id,
        desiredGrants,
        command.actorId,
      );

      // Idempotencia: solo auditar si hubo mutación efectiva
      if (replaceResult.added + replaceResult.updated + replaceResult.removed > 0) {
        await this.deps.auditLogger.log({
          action: 'PERMISSION_CHANGE',
          entity: 'Role',
          entityId: role.id,
          actor: command.actorId,
          ip: command.ip,
          before: {
            code: role.code,
            name: role.name,
            permissions: currentGrants.map((g) => ({
              permissionCode: g.permissionCode,
              scope: g.scope,
            })),
          },
          after: {
            code: role.code,
            name: role.name,
            permissions: requestedGrants,
          },
        });
      }

      const updatedDto = await this.deps.roleReader.findById(role.id);
      if (!updatedDto) {
        throw new AppError(
          'No se pudo recuperar el rol tras actualizar sus permisos',
          'INTERNAL_ERROR',
          500,
        );
      }

      return roleDtoSchema.parse(updatedDto);
    });
  }
}
