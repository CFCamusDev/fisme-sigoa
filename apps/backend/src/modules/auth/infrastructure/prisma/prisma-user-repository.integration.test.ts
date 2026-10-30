import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaUserRepository } from './prisma-user-repository.js';
import { User } from '../../domain/entities/user.js';
import { LoginPolicy } from '../../domain/value-objects/login-policy.js';
import { NotFoundError } from '../../../../shared/errors/app-error.js';

describe('PrismaUserRepository Integration (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const userRepo = new PrismaUserRepository(uow);
  const policy = new LoginPolicy();

  it('finds a user by email ignoring case and surrounding spaces', async () => {
    const email = 'repo-find-case@untrm.edu.pe';
    await prisma.user.create({
      data: {
        names: 'Test',
        firstSurname: 'Case',
        email,
        status: 'ACTIVE',
      },
    });

    const found = await userRepo.findByEmail('   REPO-FIND-CASE@UNTRM.EDU.PE   ');
    expect(found).not.toBeNull();
    expect(found?.email).toBe(email);
    expect(found?.status).toBe('ACTIVE');
  });

  it('returns null when the email does not exist', async () => {
    const found = await userRepo.findByEmail('non-existent-email-999@untrm.edu.pe');
    expect(found).toBeNull();
  });

  it('persists failed attempts, lock and last login on save', async () => {
    const email = 'repo-save@untrm.edu.pe';
    const created = await prisma.user.create({
      data: {
        names: 'Save',
        firstSurname: 'Test',
        email,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
      },
    });

    const user = await userRepo.findByEmail(email);
    expect(user).not.toBeNull();

    const now = new Date('2026-10-30T12:00:00.000Z');
    user!.registerFailedLogin(now, policy);
    await userRepo.save(user!);

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.failedLoginAttempts).toBe(1);

    user!.registerSuccessfulLogin(now);
    await userRepo.save(user!);

    const inDbAfterSuccess = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDbAfterSuccess.failedLoginAttempts).toBe(0);
    expect(inDbAfterSuccess.lockedUntil).toBeNull();
    expect(inDbAfterSuccess.lastLoginAt).toEqual(now);
  });

  it('throws not found when saving a missing user', async () => {
    const ghostUser = User.restore({
      id: 'usr_ghost_missing',
      names: 'Ghost',
      firstSurname: 'User',
      email: 'ghost@untrm.edu.pe',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
    });

    await expect(userRepo.save(ghostUser)).rejects.toThrow(NotFoundError);
  });

  it('throws when findByEmailForUpdate is called outside an active transaction', async () => {
    await expect(userRepo.findByEmailForUpdate('repo-outside-tx@untrm.edu.pe')).rejects.toThrow(
      /transacción activa/i,
    );
  });

  it('uses the active transaction client and rolls back on failure', async () => {
    const email = 'repo-tx-rollback@untrm.edu.pe';
    const created = await prisma.user.create({
      data: {
        names: 'Rollback',
        firstSurname: 'Test',
        email,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
      },
    });

    const action = uow.run(async () => {
      const user = await userRepo.findByEmailForUpdate(email);
      expect(user).not.toBeNull();
      user!.registerFailedLogin(new Date(), policy);
      await userRepo.save(user!);
      throw new Error('Forced transaction abort');
    });

    await expect(action).rejects.toThrow('Forced transaction abort');

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.failedLoginAttempts).toBe(0);
  });

  it('serializes concurrent failed logins with a row lock', async () => {
    const email = 'repo-concurrent-lock@untrm.edu.pe';
    const created = await prisma.user.create({
      data: {
        names: 'Concurrent',
        firstSurname: 'RowLock',
        email,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
      },
    });

    let tx1ReadNotify: () => void = () => {};
    const tx1ReadPromise = new Promise<void>((resolve) => {
      tx1ReadNotify = resolve;
    });

    let tx2AttemptNotify: () => void = () => {};
    const tx2AttemptPromise = new Promise<void>((resolve) => {
      tx2AttemptNotify = resolve;
    });

    const now = new Date('2026-10-30T14:00:00.000Z');

    const tx1 = uow.run(async () => {
      const u1 = await userRepo.findByEmailForUpdate(email);
      expect(u1).not.toBeNull();
      tx1ReadNotify();

      // Esperar a que tx2 inicie su intento y ceder el ciclo de eventos a la I/O de red
      await tx2AttemptPromise;
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      u1!.registerFailedLogin(now, policy);
      await userRepo.save(u1!);
    });

    const tx2 = (async () => {
      await tx1ReadPromise;
      return uow.run(async () => {
        tx2AttemptNotify();
        const u2 = await userRepo.findByEmailForUpdate(email);
        expect(u2).not.toBeNull();
        u2!.registerFailedLogin(now, policy);
        await userRepo.save(u2!);
      });
    })();

    await Promise.all([tx1, tx2]);

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.failedLoginAttempts).toBe(2);
  }, 30_000);
});
