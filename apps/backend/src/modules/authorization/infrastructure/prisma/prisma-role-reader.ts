import type { RoleSummary } from '@sigoa/shared';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { RoleReader } from '../../domain/ports/role-reader.js';

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
}
