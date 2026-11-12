import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';

describe('ActivationToken Schema & Constraints Integration (T-004-01, RF-004, RNF-005)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('has a unique index on tokenHash and an index on userId', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'activation_tokens'
      `;

    expect(indexes.length).toBeGreaterThan(0);

    // Índice único en tokenHash
    const tokenHashUniqueIndex = indexes.find(
      (idx) =>
        idx.indexdef.toLowerCase().includes('unique') &&
        (idx.indexdef.includes('tokenHash') || idx.indexdef.includes('token_hash')),
    );
    expect(tokenHashUniqueIndex).toBeDefined();

    // Índice en userId
    const userIdIndex = indexes.find(
      (idx) => idx.indexdef.includes('userId') || idx.indexdef.includes('user_id'),
    );
    expect(userIdIndex).toBeDefined();
  }, 10_000);

  it('allows null usedAt and revokedAt columns', async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'activation_tokens'
      `;

    const usedAtCol = columns.find(
      (col) => col.column_name === 'usedAt' || col.column_name === 'used_at',
    );
    const revokedAtCol = columns.find(
      (col) => col.column_name === 'revokedAt' || col.column_name === 'revoked_at',
    );
    const tokenHashCol = columns.find(
      (col) => col.column_name === 'tokenHash' || col.column_name === 'token_hash',
    );

    expect(usedAtCol).toBeDefined();
    expect(usedAtCol?.is_nullable).toBe('YES');

    expect(revokedAtCol).toBeDefined();
    expect(revokedAtCol?.is_nullable).toBe('YES');

    expect(tokenHashCol).toBeDefined();
    expect(tokenHashCol?.is_nullable).toBe('NO');
  }, 10_000);

  it('restricts deleting a user with activation tokens', async () => {
    const user = await prisma.user.create({
      data: {
        names: 'Schema',
        firstSurname: 'Tester',
        email: 'schema-restrict-fk@untrm.edu.pe',
        status: 'PENDING_ACTIVATION',
      },
    });

    await prisma.activationToken.create({
      data: {
        userId: user.id,
        tokenHash: 'test-schema-token-hash-restrict-12345',
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });

    // Intentar borrar el usuario con tokens asociados debe ser rechazado por ON DELETE RESTRICT
    await expect(
      prisma.user.delete({
        where: { id: user.id },
      }),
    ).rejects.toThrow();
  }, 10_000);
});
