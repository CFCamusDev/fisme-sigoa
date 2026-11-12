import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  DesiredGrant,
  GrantRecord,
  ReplaceGrantsResult,
} from '../../domain/ports/grant-types.js';
import type { UserPermissionRepository } from '../../domain/ports/user-permission-repository.js';
import { diffGrants } from '../../domain/policies/grant-diff.js';

export class PrismaUserPermissionRepository implements UserPermissionRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findByUserId(userId: string): Promise<GrantRecord[]> {
    const rows = await this.dbProvider.get().userPermission.findMany({
      where: { userId },
      include: { permission: { select: { code: true } } },
      orderBy: { permission: { code: 'asc' } },
    });
    return rows.map((row) => ({
      permissionId: row.permissionId,
      permissionCode: row.permission.code,
      scope: row.scope,
    }));
  }

  async replaceForUser(
    userId: string,
    desired: DesiredGrant[],
    actorId: string | null,
  ): Promise<ReplaceGrantsResult> {
    if (!(this.dbProvider.isInTransaction?.() ?? false))
      throw new Error(
        'replaceForUser solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    diffGrants([], desired);
    const client = this.dbProvider.get();
    const current = await client.userPermission.findMany({
      where: { userId },
      select: { id: true, permissionId: true, scope: true },
    });
    const { toRemove, toAdd, toUpdate } = diffGrants(current, desired);
    if (toRemove.length)
      await client.userPermission.deleteMany({ where: { id: { in: toRemove } } });
    if (toAdd.length)
      await client.userPermission.createMany({
        data: toAdd.map((grant) => ({ userId, ...grant, createdBy: actorId, updatedBy: actorId })),
      });
    for (const grant of toUpdate)
      await client.userPermission.update({
        where: { id: grant.id },
        data: { scope: grant.scope, updatedBy: actorId },
      });
    return { added: toAdd.length, updated: toUpdate.length, removed: toRemove.length };
  }
}
