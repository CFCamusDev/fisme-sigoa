import type { CommitteeMember as PrismaCommitteeMemberRow } from '../../../../shared/prisma/generated/client.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { CommitteeMember } from '../../domain/entities/committee-member.js';
import type { CommitteeMemberPosition } from '../../domain/entities/committee-member-position.js';
import { InvalidQualityCommitteeDataError } from '../../domain/errors/invalid-quality-committee-data-error.js';
import type {
  CommitteeMemberRepository,
  CreateCommitteeMembersInput,
  ReplaceCommitteeMembersInput,
} from '../../domain/ports/committee-member-repository.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

function mapRowToDomain(row: PrismaCommitteeMemberRow): CommitteeMember {
  return {
    id: row.id,
    committeeId: row.committeeId,
    fullName: row.fullName,
    degree: row.degree,
    position: row.position as CommitteeMemberPosition,
    userId: row.userId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export class PrismaCommitteeMemberRepository implements CommitteeMemberRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async listByCommittee(committeeId: string): Promise<readonly CommitteeMember[]> {
    const rows = await this.dbProvider.get().committeeMember.findMany({
      where: { committeeId },
      orderBy: [{ position: 'asc' }, { fullName: 'asc' }, { id: 'asc' }],
    });

    return rows.map(mapRowToDomain);
  }

  async listByCommittees(committeeIds: readonly string[]): Promise<readonly CommitteeMember[]> {
    if (committeeIds.length === 0) {
      return [];
    }

    const rows = await this.dbProvider.get().committeeMember.findMany({
      where: { committeeId: { in: [...committeeIds] } },
      orderBy: [{ committeeId: 'asc' }, { position: 'asc' }, { fullName: 'asc' }, { id: 'asc' }],
    });

    return rows.map(mapRowToDomain);
  }

  async createMany(input: CreateCommitteeMembersInput): Promise<readonly CommitteeMember[]> {
    if (input.entries.length === 0) {
      return [];
    }

    try {
      await this.dbProvider.get().committeeMember.createMany({
        data: input.entries.map((entry) => ({
          committeeId: input.committeeId,
          fullName: entry.fullName,
          degree: entry.degree,
          position: entry.position,
          userId: entry.userId,
          createdBy: input.actorId,
          createdAt: input.now,
        })),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new InvalidQualityCommitteeDataError(
          'Un mismo usuario no puede vincularse más de una vez en el mismo Comité de Calidad.',
        );
      }
      throw error;
    }

    return this.listByCommittee(input.committeeId);
  }

  async replaceForCommittee(
    input: ReplaceCommitteeMembersInput,
  ): Promise<readonly CommitteeMember[]> {
    const db = this.dbProvider.get();

    await db.committeeMember.deleteMany({
      where: { committeeId: input.committeeId },
    });

    return this.createMany(input);
  }
}
