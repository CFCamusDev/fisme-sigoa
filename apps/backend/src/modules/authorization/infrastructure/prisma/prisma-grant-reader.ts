import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Grant, GrantReader } from '../../domain/index.js';

export class PrismaGrantReader implements GrantReader {
  public constructor(private readonly dbProvider: DbProvider) {}

  public async findGrantsByUserId(userId: string): Promise<Grant[]> {
    const client = this.dbProvider.get();

    const userRoles = await client.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const grants: Grant[] = [];

    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        grants.push({
          permission: rp.permission.code,
          scope: rp.scope,
        });
      }
    }

    return grants;
  }
}
