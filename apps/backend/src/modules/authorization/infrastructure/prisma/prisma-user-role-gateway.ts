import { ValidationError } from '../../../../shared/errors/app-error.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';

export class PrismaUserRoleGateway {
  public constructor(private readonly dbProvider: DbProvider) {}

  public async replaceRoles(userId: string, roleIds: string[]): Promise<void> {
    const client = this.dbProvider.get();

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
    const toDelete = [...currentRoleIds].filter((id) => !targetRoleIds.has(id));
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

    // Si no hay cambios, la operación es idempotente y no escribe
    if (toDelete.length === 0 && toAdd.length === 0) {
      return;
    }

    if (toDelete.length > 0) {
      await client.userRole.deleteMany({
        where: {
          userId,
          roleId: { in: toDelete },
        },
      });
    }

    if (toAdd.length > 0) {
      await client.userRole.createMany({
        data: toAdd.map((roleId) => ({
          userId,
          roleId,
        })),
      });
    }
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
