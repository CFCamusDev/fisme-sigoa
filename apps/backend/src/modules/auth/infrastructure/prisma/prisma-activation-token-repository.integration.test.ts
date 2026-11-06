import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaActivationTokenRepository } from './prisma-activation-token-repository.js';
import { ActivationToken } from '../../domain/entities/activation-token.js';
import { InvalidActivationTokenError } from '../../domain/errors/invalid-activation-token-error.js';

describe('PrismaActivationTokenRepository Integration (PostgreSQL real, F5, AGENTS §4.2.7)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const tokenRepo = new PrismaActivationTokenRepository(uow);

  const createTestUser = async (email: string) => {
    return await prisma.user.create({
      data: {
        names: 'Activation',
        firstSurname: 'Tester',
        email,
        status: 'PENDING_ACTIVATION',
      },
    });
  };

  it('stores only the token hash and finds a token by its hash', async () => {
    const user = await createTestUser('act-find-success@untrm.edu.pe');
    const tokenHash = 'hash-act-find-success-1234567890abcdef1234567890abcdef';

    const activationToken = ActivationToken.create({
      userId: user.id,
      tokenHash,
      createdBy: 'admin-1',
    });

    await tokenRepo.add(activationToken);

    const found = await tokenRepo.findByTokenHash(tokenHash);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(activationToken.id);
    expect(found?.userId).toBe(user.id);
    expect(found?.tokenHash).toBe(tokenHash);
    expect(found?.createdBy).toBe('admin-1');
    expect(found?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(found?.usedAt).toBeNull();
    expect(found?.revokedAt).toBeNull();

    // Verificamos directamente en PostgreSQL que la columna almacenada es solo tokenHash
    const rawRow = await prisma.activationToken.findUniqueOrThrow({
      where: { tokenHash },
    });
    expect(rawRow.tokenHash).toBe(tokenHash);
    expect((rawRow as unknown as { token?: string }).token).toBeUndefined();
  });

  it('returns null for an unknown hash', async () => {
    const found = await tokenRepo.findByTokenHash('non-existent-activation-hash-999');
    expect(found).toBeNull();
  });

  it('revokes only the pending tokens of the user without touching used or others', async () => {
    const userA = await createTestUser('user-a-rev@untrm.edu.pe');
    const userB = await createTestUser('user-b-rev@untrm.edu.pe');

    // Token 1 de User A: pendiente (debe revocarse)
    const tokenA1 = ActivationToken.create({
      userId: userA.id,
      tokenHash: 'hash-a1',
    });
    await tokenRepo.add(tokenA1);

    // Token 2 de User A: ya usado (no debe cambiar revokedAt)
    const tokenA2 = ActivationToken.create({
      userId: userA.id,
      tokenHash: 'hash-a2',
    });
    tokenA2.consume(new Date('2026-11-01T08:00:00.000Z'));
    await tokenRepo.add(tokenA2);

    // Token de User B: pendiente de otro usuario (no debe tocarse)
    const tokenB = ActivationToken.create({
      userId: userB.id,
      tokenHash: 'hash-b',
    });
    await tokenRepo.add(tokenB);

    const revokeNow = new Date('2026-11-01T12:00:00.000Z');
    await tokenRepo.revokePendingByUserId(userA.id, revokeNow);

    const reloadedA1 = await tokenRepo.findByTokenHash('hash-a1');
    const reloadedA2 = await tokenRepo.findByTokenHash('hash-a2');
    const reloadedB = await tokenRepo.findByTokenHash('hash-b');

    expect(reloadedA1?.revokedAt).toEqual(revokeNow);
    expect(reloadedA2?.revokedAt).toBeNull();
    expect(reloadedB?.revokedAt).toBeNull();
  });

  it('rejects findByTokenHashForUpdate outside a transaction', async () => {
    const tokenHash = 'hash-outside-tx-activation';
    await expect(tokenRepo.findByTokenHashForUpdate(tokenHash)).rejects.toThrow(
      'findByTokenHashForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
    );
  });

  it('serializes concurrent consumers and exactly one of N concurrent consumptions wins (AGENTS §4.2.7/§9)', async () => {
    const user = await createTestUser('concurrent-activation@untrm.edu.pe');
    const tokenHash = 'hash-concurrent-activation-unique-12345';

    const token = ActivationToken.create({
      userId: user.id,
      tokenHash,
    });
    await tokenRepo.add(token);

    const N = 5;
    const now = new Date('2026-11-02T10:00:00.000Z');

    // N consumidores compitiendo en paralelo sobre PostgreSQL real
    const results = await Promise.allSettled(
      Array.from({ length: N }).map(async (_, index) => {
        return uow.run(async () => {
          const locked = await tokenRepo.findByTokenHashForUpdate(tokenHash);
          if (!locked) {
            throw new Error('Token not found');
          }
          // Si otro consumidor ya lo consumió, locked.consume() lanzará InvalidActivationTokenError
          locked.consume(new Date(now.getTime() + index * 1000));
          await tokenRepo.save(locked);
          return { consumer: index, success: true };
        });
      }),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactamente 1 consumidor gana
    expect(fulfilled).toHaveLength(1);
    // Exactamente N - 1 consumidores son rechazados con InvalidActivationTokenError
    expect(rejected).toHaveLength(N - 1);

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(InvalidActivationTokenError);
      }
    }

    // El token en base de datos quedó marcado como usado
    const finalState = await tokenRepo.findByTokenHash(tokenHash);
    expect(finalState?.usedAt).not.toBeNull();
  }, 30_000);

  it('rejects a duplicated token hash due to the unique constraint', async () => {
    const user1 = await createTestUser('dup-token-1@untrm.edu.pe');
    const user2 = await createTestUser('dup-token-2@untrm.edu.pe');
    const duplicateHash = 'duplicate-token-hash-unique-check-12345';

    const token1 = ActivationToken.create({
      userId: user1.id,
      tokenHash: duplicateHash,
    });
    await tokenRepo.add(token1);

    const token2 = ActivationToken.create({
      userId: user2.id,
      tokenHash: duplicateHash,
    });

    await expect(tokenRepo.add(token2)).rejects.toThrow();
  });

  it('persists consumption and revocation through save', async () => {
    const user = await createTestUser('persist-save@untrm.edu.pe');
    const tokenHash = 'persist-save-token-hash-12345';
    const token = ActivationToken.create({
      userId: user.id,
      tokenHash,
    });
    await tokenRepo.add(token);

    const consumedAt = new Date('2026-11-05T14:30:00.000Z');
    token.consume(consumedAt);
    await tokenRepo.save(token);

    const reloaded = await tokenRepo.findByTokenHash(tokenHash);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.usedAt).toEqual(consumedAt);
    expect(reloaded?.revokedAt).toBeNull();
  });

  it('save fails when the token is no longer pending (used or revoked)', async () => {
    const user = await createTestUser('save-non-pending@untrm.edu.pe');
    const tokenHash = 'save-non-pending-token-hash-12345';
    const token = ActivationToken.create({
      userId: user.id,
      tokenHash,
    });
    await tokenRepo.add(token);

    // Primer guardado: pasa de pendiente a consumido
    token.consume(new Date('2026-11-05T15:00:00.000Z'));
    await tokenRepo.save(token);

    // Segundo guardado concurrente o posterior: el registro ya no tiene usedAt = null
    await expect(tokenRepo.save(token)).rejects.toBeInstanceOf(InvalidActivationTokenError);
  });

  it('finds an expired token by hash without hiding it', async () => {
    const user = await createTestUser('expired-token@untrm.edu.pe');
    const tokenHash = 'expired-token-hash-12345';
    const pastExpiresAt = new Date(Date.now() - 3600_000);

    const expiredToken = ActivationToken.restore({
      id: 'expired-token-uuid-1',
      userId: user.id,
      tokenHash,
      expiresAt: pastExpiresAt,
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(Date.now() - 7200_000),
      createdBy: null,
    });
    await tokenRepo.add(expiredToken);

    const found = await tokenRepo.findByTokenHash(tokenHash);
    expect(found).not.toBeNull();
    expect(found?.isUsable(new Date())).toBe(false);
    expect(found?.expiresAt).toEqual(pastExpiresAt);
  });

  it('refuses to delete a user that has activation tokens (foreign key RESTRICT)', async () => {
    const user = await createTestUser('fk-restrict-user@untrm.edu.pe');
    const token = ActivationToken.create({
      userId: user.id,
      tokenHash: 'fk-restrict-token-hash-12345',
    });
    await tokenRepo.add(token);

    await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toThrow();
  });
});
