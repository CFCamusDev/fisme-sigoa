import { ValidationError } from '../../../../shared/errors/app-error.js';
import {
  PrismaUnitOfWork,
  type DbProvider,
} from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaUserRoleRepository } from './prisma-user-role-repository.js';
import type { PrismaClient } from '../../../../shared/prisma/generated/client.js';

export class PrismaUserRoleGateway {
  public constructor(private readonly dbProvider: DbProvider) {}

  public async replaceRoles(userId: string, roleIds: string[]): Promise<void> {
    const client = this.dbProvider.get();
    if (!(this.dbProvider.isInTransaction?.() ?? false)) {
      if (!('$transaction' in client)) throw new Error('Se requiere una transacción activa');
      const unitOfWork = new PrismaUnitOfWork(client as PrismaClient);
      return unitOfWork.run(() =>
        new PrismaUserRoleGateway(unitOfWork).replaceRoles(userId, roleIds),
      );
    }

    // 1. Validar en una sola consulta que todos los roles existan
    let existingRoles: Array<{ id: string; status: 'ACTIVE' | 'INACTIVE' }> = [];
    if (roleIds.length > 0) {
      existingRoles = await client.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, status: true },
      });

      if (existingRoles.length !== roleIds.length) {
        throw new ValidationError('Uno o más roles no existen');
      }
    }

    // 2. Obtener las asignaciones actuales del usuario
    const currentAssignments = await client.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });

    const currentRoleIds = new Set(currentAssignments.map((a) => a.roleId));
    const targetRoleIds = new Set(roleIds);

    // 3. Determinar roles a eliminar y roles a agregar
    const toAdd = [...targetRoleIds].filter((id) => !currentRoleIds.has(id));

    // Validar que los roles a agregar no estén inactivos (D4)
    if (toAdd.length > 0) {
      const inactiveToAdd = existingRoles.filter(
        (role) => toAdd.includes(role.id) && role.status === 'INACTIVE',
      );
      if (inactiveToAdd.length > 0) {
        throw new ValidationError('No se puede asignar un rol inactivo');
      }
    }

    await new PrismaUserRoleRepository(this.dbProvider).replaceForUser(userId, roleIds, null);
  }

  public async getRoleIds(userIds: string[]): Promise<Map<string, string[]>> {
    const roleMap = new Map<string, string[]>();
    for (const id of userIds) {
      roleMap.set(id, []);
    }

    if (userIds.length === 0) {
      return roleMap;
    }

    const client = this.dbProvider.get();
    const assignments = await client.userRole.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, roleId: true },
    });

    for (const a of assignments) {
      const list = roleMap.get(a.userId);
      if (list) {
        list.push(a.roleId);
      }
    }

    return roleMap;
  }
}
