import type { PermissionScope } from '@sigoa/shared';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  DesiredRoleGrant,
  ReplaceRoleGrantsResult,
  RoleGrantRecord,
  RolePermissionRepository,
} from '../../domain/ports/role-permission-repository.js';

export class PrismaRolePermissionRepository implements RolePermissionRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findByRoleId(roleId: string): Promise<RoleGrantRecord[]> {
    const client = this.dbProvider.get();
    const rows = await client.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: {
          select: {
            code: true,
          },
        },
      },
      orderBy: {
        permission: {
          code: 'asc',
        },
      },
    });

    return rows.map((r) => ({
      permissionId: r.permissionId,
      permissionCode: r.permission.code,
      scope: r.scope as PermissionScope,
    }));
  }

  async replaceForRole(
    roleId: string,
    desired: DesiredRoleGrant[],
    actorId: string | null,
  ): Promise<ReplaceRoleGrantsResult> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'replaceForRole solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const seen = new Set<string>();
    for (const item of desired) {
      if (seen.has(item.permissionId)) {
        throw new Error('El conjunto deseado contiene permisos duplicados');
      }
      seen.add(item.permissionId);
    }

    const client = this.dbProvider.get();
    const currentGrants = await client.rolePermission.findMany({
      where: { roleId },
      select: {
        id: true,
        permissionId: true,
        scope: true,
      },
    });

    const currentByPermId = new Map(currentGrants.map((g) => [g.permissionId, g]));
    const desiredByPermId = new Map(desired.map((d) => [d.permissionId, d]));

    let added = 0;
    let updated = 0;
    let removed = 0;

    const toDeleteIds: string[] = [];
    for (const current of currentGrants) {
      if (!desiredByPermId.has(current.permissionId)) {
        toDeleteIds.push(current.id);
      }
    }

    if (toDeleteIds.length > 0) {
      await client.rolePermission.deleteMany({
        where: {
          id: { in: toDeleteIds },
        },
      });
      removed = toDeleteIds.length;
    }

    for (const item of desired) {
      const existing = currentByPermId.get(item.permissionId);
      if (!existing) {
        await client.rolePermission.create({
          data: {
            roleId,
            permissionId: item.permissionId,
            scope: item.scope,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        added++;
      } else if (existing.scope !== item.scope) {
        await client.rolePermission.update({
          where: { id: existing.id },
          data: {
            scope: item.scope,
            updatedBy: actorId,
          },
        });
        updated++;
      }
    }

    return { added, updated, removed };
  }
}
