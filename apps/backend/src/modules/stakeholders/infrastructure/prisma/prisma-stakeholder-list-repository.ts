import type { Prisma } from '../../../../shared/prisma/generated/client.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { StakeholderList } from '../../domain/entities/stakeholder-list.js';
import { DuplicateStakeholderListError } from '../../domain/errors/index.js';
import type {
  ListStakeholderListsFilter,
  StakeholderListPage,
  StakeholderListReader,
  StakeholderListWithMembers,
} from '../../domain/ports/stakeholder-list-reader.js';
import type { StakeholderListRepository } from '../../domain/ports/stakeholder-list-repository.js';
import { mapPrismaStakeholderListRowToDomain } from './prisma-stakeholder-list-mapper.js';
import { mapPrismaStakeholderListMemberRowToDomain } from './prisma-stakeholder-list-member-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

export class PrismaStakeholderListRepository
  implements StakeholderListRepository, StakeholderListReader
{
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<StakeholderList | null> {
    const row = await this.dbProvider.get().stakeholderList.findUnique({ where: { id } });
    return row ? mapPrismaStakeholderListRowToDomain(row) : null;
  }

  async save(list: StakeholderList): Promise<void> {
    try {
      await this.dbProvider.get().stakeholderList.create({
        data: {
          id: list.id,
          programId: list.programId,
          type: list.type,
          year: list.year,
          studyPlanNumber: list.studyPlanNumber,
          version: list.version,
          createdBy: list.createdBy,
          createdAt: list.createdAt,
          updatedAt: list.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateStakeholderListError();
      }
      throw error;
    }
  }

  async list(filter: ListStakeholderListsFilter): Promise<StakeholderListPage> {
    const where: Prisma.StakeholderListWhereInput = {};
    if (filter.type !== undefined) {
      where.type = filter.type;
    }
    if (filter.year !== undefined) {
      where.year = filter.year;
    }

    const db = this.dbProvider.get();
    const total = await db.stakeholderList.count({ where });

    if (filter.includeMembers) {
      const rows = await db.stakeholderList.findMany({
        where,
        orderBy: [{ year: 'desc' }, { type: 'asc' }, { id: 'asc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        include: {
          _count: { select: { members: true } },
          members: {
            orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
          },
        },
      });

      return {
        items: rows.map((row) => ({
          list: mapPrismaStakeholderListRowToDomain(row),
          memberCount: row._count.members,
          members: row.members.map(mapPrismaStakeholderListMemberRowToDomain),
        })),
        total,
      };
    }

    const rows = await db.stakeholderList.findMany({
      where,
      orderBy: [{ year: 'desc' }, { type: 'asc' }, { id: 'asc' }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      include: {
        _count: { select: { members: true } },
      },
    });

    return {
      items: rows.map((row) => ({
        list: mapPrismaStakeholderListRowToDomain(row),
        memberCount: row._count.members,
        members: null,
      })),
      total,
    };
  }

  async listByProgramAndYear(
    programId: string,
    year: number,
  ): Promise<readonly StakeholderListWithMembers[]> {
    const rows = await this.dbProvider.get().stakeholderList.findMany({
      where: { programId, year },
      orderBy: [{ type: 'asc' }, { id: 'asc' }],
      include: {
        members: {
          orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        },
      },
    });

    return rows.map((row) => ({
      list: mapPrismaStakeholderListRowToDomain(row),
      members: row.members.map(mapPrismaStakeholderListMemberRowToDomain),
    }));
  }
}
