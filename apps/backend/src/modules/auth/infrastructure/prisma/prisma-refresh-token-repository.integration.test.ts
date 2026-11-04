import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaRefreshTokenRepository } from './prisma-refresh-token-repository.js';
import { RefreshToken } from '../../domain/entities/refresh-token.js';

describe('PrismaRefreshTokenRepository Integration (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const tokenRepo = new PrismaRefreshTokenRepository(uow);

  const createTestUser = async (email: string) => {
    return await prisma.user.create({
      data: {
        names: 'Refresh',
        firstSurname: 'Tester',
        email,
        status: 'ACTIVE',
      },
    });
  };

  it('stores only the token hash and finds a token by its hash', async () => {
    const user = await createTestUser('rt-find-success@untrm.edu.pe');
    const tokenHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const refreshToken = RefreshToken.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      createdByIp: '192.168.1.50',
    });

    await tokenRepo.add(refreshToken);

    const found = await tokenRepo.findByTokenHash(tokenHash);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(refreshToken.id);
    expect(found?.userId).toBe(user.id);
    expect(found?.tokenHash).toBe(tokenHash);
    expect(found?.createdByIp).toBe('192.168.1.50');
    expect(found?.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(found?.revokedAt).toBeNull();
  });

  it('returns null for an unknown hash', async () => {
    const found = await tokenRepo.findByTokenHash('non-existent-token-hash-123456789');
    expect(found).toBeNull();
  });

  it('rejects a duplicated hash', async () => {
    const user = await createTestUser('rt-duplicate@untrm.edu.pe');
    const tokenHash = 'duplicated-hash-constant-12345678901234567890abcdef';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const token1 = RefreshToken.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    await tokenRepo.add(token1);

    const token2 = RefreshToken.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await expect(tokenRepo.add(token2)).rejects.toThrow();
  });

  it('requires an existing user due to foreign key constraint', async () => {
    const nonExistentUserId = 'usr_does_not_exist_999';
    const tokenHash = 'hash-for-ghost-user-1234567890abcdef';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const token = RefreshToken.create({
      userId: nonExistentUserId,
      tokenHash,
      expiresAt,
    });

    await expect(tokenRepo.add(token)).rejects.toThrow();
  });

  it('finds a token for update inside a transaction', async () => {
    const user = await createTestUser('rt-for-update@untrm.edu.pe');
    const tokenHash = 'hash-for-update-tx-12345678901234567890abcdef';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const token = RefreshToken.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      createdByIp: '10.0.0.1',
    });
    await tokenRepo.add(token);

    await uow.run(async () => {
      const found = await tokenRepo.findByTokenHashForUpdate(tokenHash);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(token.id);
      expect(found?.userId).toBe(user.id);
      expect(found?.tokenHash).toBe(tokenHash);
    });
  });

  it('rejects findByTokenHashForUpdate outside a transaction', async () => {
    const tokenHash = 'hash-outside-tx-1234567890abcdef';
    await expect(tokenRepo.findByTokenHashForUpdate(tokenHash)).rejects.toThrow(
      'findByTokenHashForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
    );
  });

  it('persists the revocation date and keeps the rest immutable', async () => {
    const user = await createTestUser('rt-save-revocation@untrm.edu.pe');
    const tokenHash = 'hash-save-revocation-1234567890abcdef';
    const expiresAt = new Date('2026-11-09T12:00:00.000Z');
    const initialIp = '192.168.1.100';

    const token = RefreshToken.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      createdByIp: initialIp,
    });
    await tokenRepo.add(token);

    const revocationDate = new Date('2026-11-02T15:00:00.000Z');
    token.revoke(revocationDate);
    await tokenRepo.save(token);

    const inDb = await prisma.refreshToken.findUniqueOrThrow({ where: { id: token.id } });
    expect(inDb.revokedAt).toEqual(revocationDate);
    expect(inDb.userId).toBe(user.id);
    expect(inDb.tokenHash).toBe(tokenHash);
    expect(inDb.expiresAt).toEqual(expiresAt);
    expect(inDb.createdByIp).toBe(initialIp);
  });

  it('a second concurrent rotation sees the token as revoked', async () => {
    const user = await createTestUser('rt-concurrent@untrm.edu.pe');
    const tokenHash = 'hash-concurrent-test-1234567890abcdef';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const token = RefreshToken.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    await tokenRepo.add(token);

    const now = new Date('2026-11-02T16:00:00.000Z');

    let tx1ReadNotify!: () => void;
    const tx1ReadPromise = new Promise<void>((resolve) => {
      tx1ReadNotify = resolve;
    });

    let tx2AttemptNotify!: () => void;
    const tx2AttemptPromise = new Promise<void>((resolve) => {
      tx2AttemptNotify = resolve;
    });

    let tx2SawRevoked = false;

    const tx1 = uow.run(async () => {
      const t1 = await tokenRepo.findByTokenHashForUpdate(tokenHash);
      expect(t1).not.toBeNull();
      tx1ReadNotify();

      // Esperar a que tx2 comience su intento y quede bloqueado en PostgreSQL
      await tx2AttemptPromise;
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      t1!.revoke(now);
      await tokenRepo.save(t1!);
    });

    const tx2 = (async () => {
      await tx1ReadPromise;
      return uow.run(async () => {
        tx2AttemptNotify();
        const t2 = await tokenRepo.findByTokenHashForUpdate(tokenHash);
        expect(t2).not.toBeNull();
        if (t2!.isRevoked()) {
          tx2SawRevoked = true;
        }
      });
    })();

    await Promise.all([tx1, tx2]);

    expect(tx2SawRevoked).toBe(true);
  }, 30_000);
});
