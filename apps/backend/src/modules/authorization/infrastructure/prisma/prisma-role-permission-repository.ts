import type { PermissionScope } from '@sigoa/shared';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { diffGrants } from '../../domain/policies/grant-diff.js';
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

    diffGrants([], desired);

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
    const { toRemove: toDeleteIds, toAdd, toUpdate } = diffGrants(currentGrants, desired);
    const addedIds = new Set(toAdd.map((grant) => grant.permissionId));
    const updatedIds = new Set(toUpdate.map((grant) => grant.id));

    if (toDeleteIds.length > 0) {
      await client.rolePermission.deleteMany({
        where: {
          id: { in: toDeleteIds },
        },
      });
    }

    for (const item of desired) {
      const existing = currentByPermId.get(item.permissionId);
      if (!existing && addedIds.has(item.permissionId)) {
        await client.rolePermission.create({
          data: {
            roleId,
            permissionId: item.permissionId,
            scope: item.scope,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
      } else if (existing && updatedIds.has(existing.id)) {
        await client.rolePermission.update({
          where: { id: existing.id },
          data: {
            scope: item.scope,
            updatedBy: actorId,
          },
        });
      }
    }

    return { added: toAdd.length, updated: toUpdate.length, removed: toDeleteIds.length };
  }
}
