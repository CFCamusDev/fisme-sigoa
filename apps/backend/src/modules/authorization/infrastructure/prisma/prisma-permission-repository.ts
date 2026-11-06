import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { PermissionRecord } from '../../domain/entities/permission.js';
import type { PermissionRepository } from '../../domain/ports/permission-repository.js';

export class PrismaPermissionRepository implements PermissionRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findAll(): Promise<PermissionRecord[]> {
    const client = this.dbProvider.get();
    const rows = await client.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        description: true,
        module: true,
      },
    });

    return rows;
  }

  async findByCodes(codes: string[]): Promise<PermissionRecord[]> {
    if (!codes || codes.length === 0) {
      return [];
    }

    const uniqueCodes = Array.from(new Set(codes.map((c) => c.trim()))).filter(Boolean);
    if (uniqueCodes.length === 0) {
      return [];
    }

    const client = this.dbProvider.get();
    const rows = await client.permission.findMany({
      where: {
        code: {
          in: uniqueCodes,
        },
      },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        description: true,
        module: true,
      },
    });

    return rows;
  }
}
