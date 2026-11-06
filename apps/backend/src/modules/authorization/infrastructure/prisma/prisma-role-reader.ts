import type { RoleDto, RoleSummary } from '@sigoa/shared';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { RoleReader } from '../../domain/ports/role-reader.js';

interface PrismaDetailedRoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  deactivatedAt: Date | null;
  isPredefined: boolean;
  updatedAt: Date;
  rolePermissions: Array<{
    scope: 'GLOBAL' | 'OWN';
    permission: {
      code: string;
    };
  }>;
  _count: {
    userRoles: number;
  };
}

function mapDetailedRoleRow(row: PrismaDetailedRoleRow): RoleDto {
  const permissions = row.rolePermissions
    .map((rp) => ({
      permissionCode: rp.permission.code,
      scope: rp.scope,
    }))
    .sort((a, b) => a.permissionCode.localeCompare(b.permissionCode));

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isPredefined: row.isPredefined,
    status: row.status,
    deactivatedAt: row.deactivatedAt ? row.deactivatedAt.toISOString() : null,
    userCount: row._count.userRoles,
    permissions,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaRoleReader implements RoleReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async listAll(): Promise<RoleSummary[]> {
    const client = this.dbProvider.get();
    const rows = await client.role.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isPredefined: true,
      },
      orderBy: [{ isPredefined: 'desc' }, { name: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      isPredefined: row.isPredefined,
    }));
  }

  async listDetailed(): Promise<RoleDto[]> {
    const client = this.dbProvider.get();
    const rows = (await client.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                code: true,
              },
            },
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
      orderBy: [{ isPredefined: 'desc' }, { name: 'asc' }],
    })) as unknown as PrismaDetailedRoleRow[];

    return rows.map(mapDetailedRoleRow);
  }

  async findById(id: string): Promise<RoleDto | null> {
    const client = this.dbProvider.get();
    const row = (await client.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                code: true,
              },
            },
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    })) as unknown as PrismaDetailedRoleRow | null;

    return row ? mapDetailedRoleRow(row) : null;
  }
}
