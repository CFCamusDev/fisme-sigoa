import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { SessionStakeholderType } from '../../domain/entities/session-stakeholder-type.js';
import type {
  SessionStakeholderListReader,
  SessionStakeholderListRef,
} from '../../domain/ports/session-stakeholder-list-reader.js';

export class PrismaSessionStakeholderListReader implements SessionStakeholderListReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<SessionStakeholderListRef | null> {
    const row = await this.dbProvider.get().stakeholderList.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      type: row.type as SessionStakeholderType,
    };
  }
}
