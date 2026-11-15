import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { useTestDatabase } from '../db/use-test-database.js';
import { seedE2EUser } from './seed-e2e-user.js';

describe('seedE2EUser with activationToken (T-004-17, RF-004, RNF-005)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('seeds a pending user without password and only the token hash', async () => {
    const rawToken = 'test-token-valid-abc1234567890';
    const email = `pending-${Date.now()}@example.test`;

    const result = await seedE2EUser({
      email,
      names: 'Usuario Pendiente',
      firstSurname: 'Prueba',
      activationToken: {
        token: rawToken,
      },
    });

    expect(result.email).toBe(email);

    const user = await prisma.user.findUnique({
      where: { id: result.id },
      include: { activationTokens: true },
    });

    expect(user).not.toBeNull();
    expect(user?.status).toBe('PENDING_ACTIVATION');
    expect(user?.passwordHash).toBeNull();
    expect(user?.activationTokens.length).toBe(1);

    const tokenRecord = user!.activationTokens[0]!;
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');
    expect(tokenRecord.tokenHash).toBe(expectedHash);
    expect(tokenRecord.usedAt).toBeNull();
    expect(tokenRecord.expiresAt.getTime()).toBeGreaterThan(Date.now());
  }, 30_000);

  it('seeds an expired and a used token', async () => {
    const rawToken = 'test-token-used-and-expired';
    const email = `expired-${Date.now()}@example.test`;
    const pastDate = new Date(Date.now() - 3600 * 1000);

    const result = await seedE2EUser({
      email,
      status: 'PENDING_ACTIVATION',
      activationToken: {
        token: rawToken,
        expiresAt: pastDate,
        used: true,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: result.id },
      include: { activationTokens: true },
    });

    expect(user).not.toBeNull();
    const tokenRecord = user!.activationTokens[0]!;
    expect(tokenRecord.usedAt).not.toBeNull();
    expect(tokenRecord.expiresAt.getTime()).toBeLessThan(Date.now());
  }, 30_000);

  it('seeds an active user with roles using fast authorization seeding', async () => {
    const email = `admin-${Date.now()}@example.test`;

    const result = await seedE2EUser({
      email,
      roles: ['ADMINISTRATOR'],
    });

    const user = await prisma.user.findUnique({
      where: { id: result.id },
      include: { userRoles: { include: { role: true } } },
    });

    expect(user?.status).toBe('ACTIVE');
    expect(user?.passwordHash).not.toBeNull();
    expect(user?.userRoles.map((ur) => ur.role.code)).toContain('ADMINISTRATOR');
  }, 30_000);
});
