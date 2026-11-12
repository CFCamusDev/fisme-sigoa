import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  UserRoleRecord,
  UserRoleRepository,
} from '../../domain/ports/user-role-repository.js';

export class PrismaUserRoleRepository implements UserRoleRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findByUserId(userId: string): Promise<UserRoleRecord[]> {
    const rows = await this.dbProvider.get().userRole.findMany({
      where: { userId },
      include: { role: true },
      orderBy: { role: { code: 'asc' } },
    });
    return rows.map(({ role }) => ({
      roleId: role.id,
      roleCode: role.code,
      roleName: role.name,
      roleStatus: role.status,
    }));
  }

  async replaceForUser(
    userId: string,
    roleIds: string[],
    actorId: string | null,
  ): Promise<{ added: string[]; removed: string[] }> {
    if (!(this.dbProvider.isInTransaction?.() ?? false)) {
      throw new Error(
        'replaceForUser solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }
    if (new Set(roleIds).size !== roleIds.length)
      throw new Error('El conjunto deseado contiene roles duplicados');
    const client = this.dbProvider.get();
    const rows = await client.userRole.findMany({ where: { userId }, select: { roleId: true } });
    const current = new Set(rows.map(({ roleId }) => roleId));
    const desired = new Set(roleIds);
    const removed = [...current].filter((id) => !desired.has(id));
    const added = roleIds.filter((id) => !current.has(id));
    if (removed.length)
      await client.userRole.deleteMany({ where: { userId, roleId: { in: removed } } });
    if (added.length)
      await client.userRole.createMany({
        data: added.map((roleId) => ({ userId, roleId, createdBy: actorId, updatedBy: actorId })),
      });
    return { added, removed };
  }

  async countActiveHolders(roleId: string, excludingUserId: string): Promise<number> {
    return this.dbProvider.get().userRole.count({
      where: { roleId, userId: { not: excludingUserId }, user: { status: 'ACTIVE' } },
    });
  }
}
