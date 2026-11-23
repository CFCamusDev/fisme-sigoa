import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { SessionListMemberRef } from '../../domain/policies/attendee-selection.js';
import type {
  SessionListMemberReader,
  SessionListMemberRosterItem,
} from '../../domain/ports/session-list-member-reader.js';

const DEFAULT_ROSTER_LIMIT = 1000;

export class PrismaSessionListMemberReader implements SessionListMemberReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async findByIds(ids: readonly string[]): Promise<readonly SessionListMemberRef[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return [];
    }

    return this.dbProvider.get().stakeholderListMember.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        listId: true,
        fullName: true,
      },
    });
  }

  async listByList(
    listId: string,
    limit: number = DEFAULT_ROSTER_LIMIT,
  ): Promise<readonly SessionListMemberRosterItem[]> {
    return this.dbProvider.get().stakeholderListMember.findMany({
      where: { listId },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        fullName: true,
        institution: true,
        ruc: true,
        representative: true,
        position: true,
      },
    });
  }
}
