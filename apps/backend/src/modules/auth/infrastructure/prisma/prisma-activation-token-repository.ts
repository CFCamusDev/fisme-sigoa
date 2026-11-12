import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { ActivationToken } from '../../domain/entities/activation-token.js';
import { InvalidActivationTokenError } from '../../domain/errors/invalid-activation-token-error.js';
import type { ActivationTokenRepository } from '../../domain/ports/activation-token-repository.js';

interface PrismaActivationTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
}

export class PrismaActivationTokenRepository implements ActivationTokenRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  private mapToDomain(row: PrismaActivationTokenRow): ActivationToken {
    return ActivationToken.restore({
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    });
  }

  async add(token: ActivationToken): Promise<void> {
    const client = this.dbProvider.get();

    await client.activationToken.create({
      data: {
        id: token.id,
        userId: token.userId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        usedAt: token.usedAt,
        revokedAt: token.revokedAt,
        createdBy: token.createdBy,
        ...(token.createdAt ? { createdAt: token.createdAt } : {}),
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<ActivationToken | null> {
    const client = this.dbProvider.get();

    const row = await client.activationToken.findUnique({
      where: { tokenHash },
    });

    return row ? this.mapToDomain(row) : null;
  }

  async findByTokenHashForUpdate(tokenHash: string): Promise<ActivationToken | null> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'findByTokenHashForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const client = this.dbProvider.get();

    const rows = await client.$queryRaw<PrismaActivationTokenRow[]>`
      SELECT
        id,
        "userId",
        "tokenHash",
        "expiresAt",
        "usedAt",
        "revokedAt",
        "createdAt",
        "createdBy"
      FROM activation_tokens
      WHERE "tokenHash" = ${tokenHash}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async save(token: ActivationToken): Promise<void> {
    const client = this.dbProvider.get();

    const result = await client.activationToken.updateMany({
      where: {
        id: token.id,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        usedAt: token.usedAt,
        revokedAt: token.revokedAt,
      },
    });

    if (result.count === 0) {
      throw new InvalidActivationTokenError();
    }
  }

  async revokePendingByUserId(userId: string, revokedAt: Date): Promise<void> {
    const client = this.dbProvider.get();

    await client.activationToken.updateMany({
      where: {
        userId,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });
  }

  async findLatestCreatedAtByUserId(userId: string): Promise<Date | null> {
    const client = this.dbProvider.get();

    const row = await client.activationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return row ? row.createdAt : null;
  }
}
