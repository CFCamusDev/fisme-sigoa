import type { UserStatus } from '@sigoa/shared';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  UserListFilter,
  UserListReader,
  UserListResult,
} from '../../domain/ports/user-list-reader.js';
import { mapPrismaUserRowToDomain, type PrismaUserRow } from './prisma-user-mapper.js';

export class PrismaUserListReader implements UserListReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async list(filter: UserListFilter): Promise<UserListResult> {
    const client = this.dbProvider.get();

    const where: {
      status?: UserStatus;
      userRoles?: {
        some: {
          roleId: string;
        };
      };
    } = {};

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.roleId) {
      where.userRoles = {
        some: {
          roleId: filter.roleId,
        },
      };
    }

    const skip = Math.max(0, (filter.page - 1) * filter.pageSize);
    const take = filter.pageSize;

    // Decisión D6: dos consultas paralelas para alto rendimiento sin bloquear lecturas concurrentes
    const [total, rows] = await Promise.all([
      client.user.count({ where }),
      client.user.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    return {
      items: rows.map((row) => mapPrismaUserRowToDomain(row as PrismaUserRow)),
      total,
    };
  }
}
