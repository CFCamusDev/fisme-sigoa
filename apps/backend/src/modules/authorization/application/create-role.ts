import { randomUUID } from 'node:crypto';
import { roleDtoSchema, type RoleDto } from '@sigoa/shared';
import { AppError } from '../../../shared/errors/app-error.js';
import { Role } from '../domain/entities/role.js';
import { InvalidRoleDataError } from '../domain/errors/invalid-role-data-error.js';
import { RoleAlreadyExistsError } from '../domain/errors/role-already-exists-error.js';
import type { CreateRoleCommand, CreateRoleDependencies } from './create-role.types.js';

export class CreateRoleUseCase {
  constructor(private readonly deps: CreateRoleDependencies) {}

  async execute(command: CreateRoleCommand): Promise<RoleDto> {
    await this.deps.authorizer.assertAllowed({
      actorId: command.actorId,
      permission: 'rol.editar',
      scope: 'GLOBAL',
    });

    const requestedGrants = command.input.permissions ?? [];
    const requestedCodes = requestedGrants.map((g) => g.permissionCode);

    // Verificación defensiva de duplicados
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
      const id = (this.deps.idGenerator ?? randomUUID)();
      const role = Role.create({
        id,
        name: command.input.name,
        description: command.input.description,
        createdBy: command.actorId,
      });

      const existingByName = await this.deps.roleRepository.findByName(role.name);
      if (existingByName) {
        throw new RoleAlreadyExistsError(`Ya existe un rol con el nombre '${role.name}'.`);
      }

      const existingByCode = await this.deps.roleRepository.findByCode(role.code);
      if (existingByCode) {
        throw new RoleAlreadyExistsError(`Ya existe un rol con el código '${role.code}'.`);
      }

      await this.deps.roleRepository.add(role);

      if (requestedGrants.length > 0) {
        const desiredGrants = requestedGrants.map((grant) => {
          const perm = catalogMap.get(grant.permissionCode)!;
          return {
            permissionId: perm.id,
            scope: grant.scope,
          };
        });
        await this.deps.rolePermissionRepository.replaceForRole(
          role.id,
          desiredGrants,
          command.actorId,
        );
      }

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'Role',
        entityId: role.id,
        actor: command.actorId,
        ip: command.ip,
        after: {
          ...role.toAuditSnapshot(),
          permissions: requestedGrants,
        },
      });

      const createdDto = await this.deps.roleReader.findById(role.id);
      if (!createdDto) {
        throw new AppError('No se pudo recuperar el rol recién creado', 'INTERNAL_ERROR', 500);
      }

      return roleDtoSchema.parse(createdDto);
    });
  }
}
