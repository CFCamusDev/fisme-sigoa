import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { StakeholderListMember } from '../../domain/entities/stakeholder-list-member.js';
import { DuplicateListMemberError } from '../../domain/errors/index.js';
import type { StakeholderListMemberRepository } from '../../domain/ports/stakeholder-list-member-repository.js';
import { mapPrismaStakeholderListMemberRowToDomain } from './prisma-stakeholder-list-member-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

function toCreateInput(member: StakeholderListMember) {
  return {
    id: member.id,
    listId: member.listId,
    stakeholderId: member.stakeholderId,
    fullName: member.fullName,
    institution: member.institution,
    ruc: member.ruc,
    sector: member.sector,
    representative: member.representative,
    activity: member.activity,
    email: member.email,
    mobile: member.mobile,
    position: member.position,
    graduationYear: member.graduationYear,
    cycle: member.cycle,
    createdBy: member.createdBy,
    createdAt: member.createdAt,
  };
}

export class PrismaStakeholderListMemberRepository implements StakeholderListMemberRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async add(member: StakeholderListMember): Promise<void> {
    try {
      await this.dbProvider.get().stakeholderListMember.create({
        data: toCreateInput(member),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateListMemberError();
      }
      throw error;
    }
  }

  async addMany(members: readonly StakeholderListMember[]): Promise<void> {
    if (members.length === 0) {
      return;
    }

    try {
      await this.dbProvider.get().stakeholderListMember.createMany({
        data: members.map(toCreateInput),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateListMemberError();
      }
      throw error;
    }
  }

  async listByListId(listId: string): Promise<StakeholderListMember[]> {
    const rows = await this.dbProvider.get().stakeholderListMember.findMany({
      where: { listId },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
    return rows.map(mapPrismaStakeholderListMemberRowToDomain);
  }
}
