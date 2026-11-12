import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { RefreshToken } from '../../domain/entities/refresh-token.js';
import type { RefreshTokenRepository } from '../../domain/ports/refresh-token-repository.js';
import { NotFoundError } from '../../../../shared/errors/app-error.js';

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

  private isRecordNotFoundError(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025',
    );
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

  async findByTokenHashForUpdate(tokenHash: string): Promise<RefreshToken | null> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'findByTokenHashForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const client = this.dbProvider.get();

    const rows = await client.$queryRaw<PrismaRefreshTokenRow[]>`
      SELECT
        id,
        "userId",
        "tokenHash",
        "expiresAt",
        "revokedAt",
        "createdAt",
        "createdByIp"
      FROM refresh_tokens
      WHERE "tokenHash" = ${tokenHash}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async save(token: RefreshToken): Promise<void> {
    const client = this.dbProvider.get();

    try {
      await client.refreshToken.update({
        where: { id: token.id },
        data: {
          revokedAt: token.revokedAt,
        },
      });
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        throw new NotFoundError(`Token de actualización con ID "${token.id}" no encontrado.`);
      }
      throw error;
    }
  }

  async revokeAllForUser(userId: string, now: Date): Promise<number> {
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
