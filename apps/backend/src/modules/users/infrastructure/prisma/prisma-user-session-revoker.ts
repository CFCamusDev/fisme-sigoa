import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { UserSessionRevoker } from '../../domain/ports/user-session-revoker.js';

export class PrismaUserSessionRevoker implements UserSessionRevoker {
  constructor(private readonly dbProvider: DbProvider) {}

  public async revokeAllForUser(userId: string, now: Date): Promise<number> {
    const client = this.dbProvider.get();
    const result = await client.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    return result.count;
  }
}
