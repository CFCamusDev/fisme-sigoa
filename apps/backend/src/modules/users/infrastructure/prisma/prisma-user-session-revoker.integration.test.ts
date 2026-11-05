import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaUserSessionRevoker } from './prisma-user-session-revoker.js';

describe('PrismaUserSessionRevoker Integration (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const revoker = new PrismaUserSessionRevoker(uow);

  async function createTestUserWithTokens(prefix: string) {
    const user = await prisma.user.create({
      data: {
        names: 'Test',
        firstSurname: 'Session',
        email: `${prefix}@untrm.edu.pe`,
        dni: prefix.slice(0, 8),
        status: 'ACTIVE',
      },
    });

    const token1 = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `hash-active-1-${prefix}`,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        revokedAt: null,
      },
    });

    const token2 = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `hash-active-2-${prefix}`,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        revokedAt: null,
      },
    });

    const alreadyRevoked = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `hash-already-revoked-${prefix}`,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        revokedAt: new Date('2026-11-01T00:00:00.000Z'),
      },
    });

    return { user, token1, token2, alreadyRevoked };
  }

  it('revokes only active tokens of the user and ignores other users or already revoked ones', async () => {
    const target = await createTestUserWithTokens('target11');
    const other = await createTestUserWithTokens('other111');

    const revokeTime = new Date('2026-11-03T15:00:00.000Z');
    const count = await revoker.revokeAllForUser(target.user.id, revokeTime);

    // Debe haber revocado exactamente las 2 sesiones activas de target
    expect(count).toBe(2);

    // Verificar en BD que los de target fueron actualizados
    const targetTokens = await prisma.refreshToken.findMany({
      where: { userId: target.user.id },
    });
    for (const t of targetTokens) {
      expect(t.revokedAt).not.toBeNull();
      if (t.id === target.alreadyRevoked.id) {
        expect(t.revokedAt).toEqual(new Date('2026-11-01T00:00:00.000Z'));
      } else {
        expect(t.revokedAt).toEqual(revokeTime);
      }
    }

    // Verificar que los tokens de other siguen intactos
    const otherActive = await prisma.refreshToken.findMany({
      where: { userId: other.user.id, revokedAt: null },
    });
    expect(otherActive).toHaveLength(2);
  });

  it('is idempotent when executed multiple times', async () => {
    const target = await createTestUserWithTokens('idempotent1');
    const now = new Date();

    const firstRunCount = await revoker.revokeAllForUser(target.user.id, now);
    expect(firstRunCount).toBe(2);

    const secondRunCount = await revoker.revokeAllForUser(target.user.id, now);
    expect(secondRunCount).toBe(0);
  });

  it('rolls back with the transaction when an error occurs', async () => {
    const target = await createTestUserWithTokens('rollback1');
    const now = new Date();

    await expect(
      uow.run(async () => {
        await revoker.revokeAllForUser(target.user.id, now);
        throw new Error('Simulated failure after revoking');
      }),
    ).rejects.toThrow('Simulated failure after revoking');

    const activeAfterRollback = await prisma.refreshToken.findMany({
      where: { userId: target.user.id, revokedAt: null },
    });
    expect(activeAfterRollback).toHaveLength(2);
  });
});
