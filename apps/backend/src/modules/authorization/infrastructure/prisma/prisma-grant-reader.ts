import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Grant, GrantReader } from '../../domain/index.js';

export class PrismaGrantReader implements GrantReader {
  public constructor(private readonly dbProvider: DbProvider) {}

  public async findGrantsByUserId(userId: string): Promise<Grant[]> {
    const client = this.dbProvider.get();

    const userRoles = await client.userRole.findMany({
      where: {
        userId,
        role: {
          status: 'ACTIVE',
        },
      },
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

    const directGrants = await client.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });
    for (const grant of directGrants) {
      grants.push({ permission: grant.permission.code, scope: grant.scope });
    }

    return grants;
  }
}
