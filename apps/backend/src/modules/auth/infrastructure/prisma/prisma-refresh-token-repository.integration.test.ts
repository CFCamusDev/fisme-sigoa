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
});
