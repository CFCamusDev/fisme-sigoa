import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { StakeholderListProgramResolver } from '../../domain/ports/stakeholder-list-program-resolver.js';

export class PrismaStakeholderListProgramResolver implements StakeholderListProgramResolver {
  constructor(private readonly dbProvider: DbProvider) {}

  async getCurrentProgramId(): Promise<string | null> {
    const row = await this.dbProvider.get().program.findFirst({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return row?.id ?? null;
  }
}
