import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { RefreshToken } from '../../domain/entities/refresh-token.js';
import type { RefreshTokenRepository } from '../../domain/ports/refresh-token-repository.js';

interface PrismaRefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  createdByIp: string | null;
}

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  private mapToDomain(row: PrismaRefreshTokenRow): RefreshToken {
    return RefreshToken.restore({
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      createdByIp: row.createdByIp,
    });
  }

  async add(token: RefreshToken): Promise<void> {
    const client = this.dbProvider.get();

    await client.refreshToken.create({
      data: {
        id: token.id,
        userId: token.userId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        createdByIp: token.createdByIp,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const client = this.dbProvider.get();

    const row = await client.refreshToken.findUnique({
      where: { tokenHash },
    });

    return row ? this.mapToDomain(row) : null;
  }
}
